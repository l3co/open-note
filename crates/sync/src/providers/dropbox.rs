use async_trait::async_trait;
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::error::{SyncError, SyncResult};
use crate::provider::SyncProvider;
use crate::types::{AuthToken, RemoteFile, SyncProviderType};

const TOKEN_ENDPOINT: &str = "https://api.dropboxapi.com/oauth2/token";
const REDIRECT_URI: &str = "http://localhost:19876/callback";

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    token_type: String,
    expires_in: Option<u64>,
    refresh_token: Option<String>,
}

#[derive(Deserialize)]
struct AccountInfo {
    email: Option<String>,
}

pub struct DropboxProvider {
    client_id: Option<String>,
    client_secret: Option<String>,
    http: reqwest::Client,
}

impl Default for DropboxProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl DropboxProvider {
    pub fn new() -> Self {
        Self {
            client_id: None,
            client_secret: None,
            http: reqwest::Client::new(),
        }
    }

    pub fn with_credentials(client_id: String, client_secret: String) -> Self {
        Self {
            client_id: Some(client_id),
            client_secret: Some(client_secret),
            http: reqwest::Client::new(),
        }
    }

    /// Runtime (dev) → compile-time baked (prod).
    pub fn with_env_credentials() -> Self {
        Self {
            client_id: std::env::var("DROPBOX_CLIENT_ID")
                .ok()
                .or_else(|| option_env!("DROPBOX_CLIENT_ID").map(str::to_string)),
            client_secret: std::env::var("DROPBOX_CLIENT_SECRET")
                .ok()
                .or_else(|| option_env!("DROPBOX_CLIENT_SECRET").map(str::to_string)),
            http: reqwest::Client::new(),
        }
    }

    fn require_credentials(&self) -> SyncResult<(&str, &str)> {
        match (&self.client_id, &self.client_secret) {
            (Some(id), Some(secret)) => Ok((id.as_str(), secret.as_str())),
            _ => Err(SyncError::AuthFailed {
                message: "Dropbox não configurado. Defina DROPBOX_CLIENT_ID e \
                          DROPBOX_CLIENT_SECRET nas variáveis de ambiente."
                    .to_string(),
            }),
        }
    }

    /// Lists folder entries. If `recursive=true`, returns all files recursively.
    async fn list_folder_entries(
        &self,
        token: &AuthToken,
        remote_path: &str,
        recursive: bool,
    ) -> SyncResult<Vec<RemoteFile>> {
        #[derive(Deserialize)]
        struct Entry {
            #[serde(rename = ".tag")]
            tag: String,
            name: String,
            path_display: Option<String>,
            size: Option<u64>,
            #[serde(rename = "client_modified")]
            client_modified: Option<String>,
            content_hash: Option<String>,
        }
        #[derive(Deserialize)]
        struct ListResp {
            entries: Vec<Entry>,
            cursor: Option<String>,
            has_more: Option<bool>,
        }

        let dropbox_path = if remote_path.is_empty() || remote_path == "/" {
            String::new()
        } else {
            format!("/{}", remote_path.trim_matches('/'))
        };

        let mut all = Vec::new();
        let resp = self
            .http
            .post("https://api.dropboxapi.com/2/files/list_folder")
            .bearer_auth(&token.access_token)
            .json(&serde_json::json!({
                "path": dropbox_path,
                "recursive": recursive,
                "include_media_info": false,
                "include_deleted": false
            }))
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let msg = resp.text().await.unwrap_or_default();
            return Err(SyncError::Api {
                status,
                message: msg,
            });
        }

        let mut result: ListResp = resp
            .json()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        loop {
            for entry in &result.entries {
                if entry.tag != "file" {
                    continue;
                }
                let path = entry
                    .path_display
                    .clone()
                    .unwrap_or_else(|| entry.name.clone());
                let hash = entry.content_hash.clone().unwrap_or_default();
                let size = entry.size.unwrap_or(0);
                let modified_at = entry
                    .client_modified
                    .as_deref()
                    .and_then(|s| s.parse::<chrono::DateTime<Utc>>().ok())
                    .unwrap_or_else(Utc::now);
                all.push(RemoteFile {
                    path,
                    hash,
                    size,
                    modified_at,
                });
            }

            if result.has_more.unwrap_or(false) {
                if let Some(ref cursor) = result.cursor {
                    let cont_resp = self
                        .http
                        .post("https://api.dropboxapi.com/2/files/list_folder/continue")
                        .bearer_auth(&token.access_token)
                        .json(&serde_json::json!({ "cursor": cursor }))
                        .send()
                        .await
                        .map_err(|e| SyncError::Network(e.to_string()))?;
                    result = cont_resp
                        .json()
                        .await
                        .map_err(|e| SyncError::Network(e.to_string()))?;
                    continue;
                }
            }
            break;
        }

        Ok(all)
    }
}

#[async_trait]
impl SyncProvider for DropboxProvider {
    fn name(&self) -> &str {
        "dropbox"
    }

    fn provider_type(&self) -> SyncProviderType {
        SyncProviderType::Dropbox
    }

    fn display_name(&self) -> &str {
        "Dropbox"
    }

    fn has_credentials(&self) -> bool {
        self.client_id.is_some() && self.client_secret.is_some()
    }

    fn auth_url(&self) -> String {
        let client_id = self.client_id.as_deref().unwrap_or("NOT_CONFIGURED");
        format!(
            "https://www.dropbox.com/oauth2/authorize?\
             client_id={client_id}&\
             redirect_uri={REDIRECT_URI}&\
             response_type=code&\
             token_access_type=offline"
        )
    }

    async fn exchange_code(&self, code: &str) -> SyncResult<AuthToken> {
        let (client_id, client_secret) = self.require_credentials()?;

        let resp = self
            .http
            .post(TOKEN_ENDPOINT)
            .basic_auth(client_id, Some(client_secret))
            .form(&[
                ("code", code),
                ("grant_type", "authorization_code"),
                ("redirect_uri", REDIRECT_URI),
            ])
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(SyncError::Api {
                status,
                message: body,
            });
        }

        let token_resp: TokenResponse = resp
            .json()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        Ok(build_auth_token(token_resp, None))
    }

    async fn refresh_token(&self, token: &AuthToken) -> SyncResult<AuthToken> {
        let (client_id, client_secret) = self.require_credentials()?;

        let refresh = token
            .refresh_token
            .as_deref()
            .ok_or_else(|| SyncError::AuthFailed {
                message: "Sem refresh token para Dropbox".to_string(),
            })?;

        let resp = self
            .http
            .post(TOKEN_ENDPOINT)
            .basic_auth(client_id, Some(client_secret))
            .form(&[("refresh_token", refresh), ("grant_type", "refresh_token")])
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(SyncError::Api {
                status,
                message: body,
            });
        }

        let mut token_resp: TokenResponse = resp
            .json()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if token_resp.refresh_token.is_none() {
            token_resp.refresh_token = token.refresh_token.clone();
        }

        Ok(build_auth_token(token_resp, None))
    }

    async fn revoke(&self, token: &AuthToken) -> SyncResult<()> {
        let _ = self
            .http
            .post("https://api.dropboxapi.com/2/auth/token/revoke")
            .bearer_auth(&token.access_token)
            .send()
            .await;
        Ok(())
    }

    async fn get_user_email(&self, token: &AuthToken) -> SyncResult<Option<String>> {
        let resp = self
            .http
            .post("https://api.dropboxapi.com/2/users/get_current_account")
            .bearer_auth(&token.access_token)
            .header("Content-Length", "0")
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if !resp.status().is_success() {
            return Ok(None);
        }

        let info: AccountInfo = resp
            .json()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        Ok(info.email)
    }

    async fn list_remote_files(
        &self,
        token: &AuthToken,
        remote_path: &str,
    ) -> SyncResult<Vec<RemoteFile>> {
        self.list_folder_entries(token, remote_path, false).await
    }

    async fn list_all_remote_files(
        &self,
        token: &AuthToken,
        root_path: &str,
    ) -> SyncResult<Vec<RemoteFile>> {
        self.list_folder_entries(token, root_path, true).await
    }

    async fn list_remote_folders(
        &self,
        token: &AuthToken,
        parent_path: &str,
    ) -> SyncResult<Vec<String>> {
        #[derive(Deserialize)]
        struct Entry {
            #[serde(rename = ".tag")]
            tag: String,
            name: String,
        }
        #[derive(Deserialize)]
        struct ListFolderResp {
            entries: Vec<Entry>,
        }

        let dropbox_path = if parent_path.is_empty() || parent_path == "/" {
            String::new()
        } else {
            format!("/{}", parent_path.trim_matches('/'))
        };

        let resp = self
            .http
            .post("https://api.dropboxapi.com/2/files/list_folder")
            .bearer_auth(&token.access_token)
            .json(&serde_json::json!({ "path": dropbox_path, "recursive": false }))
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if !resp.status().is_success() {
            return Ok(Vec::new());
        }

        let result: ListFolderResp = resp
            .json()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        Ok(result
            .entries
            .into_iter()
            .filter(|e| e.tag == "folder")
            .map(|e| e.name)
            .collect())
    }

    async fn download_file(&self, token: &AuthToken, remote_path: &str) -> SyncResult<Vec<u8>> {
        #[derive(Serialize)]
        struct DownloadArg<'a> {
            path: &'a str,
        }
        let arg = serde_json::to_string(&DownloadArg { path: remote_path })
            .map_err(|e| SyncError::Network(e.to_string()))?;

        let resp = self
            .http
            .post("https://content.dropboxapi.com/2/files/download")
            .bearer_auth(&token.access_token)
            .header("Dropbox-API-Arg", &arg)
            .header("Content-Length", "0")
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let msg = resp.text().await.unwrap_or_default();
            return Err(SyncError::Api {
                status,
                message: msg,
            });
        }

        resp.bytes()
            .await
            .map(|b| b.to_vec())
            .map_err(|e| SyncError::Network(e.to_string()))
    }

    async fn upload_file(
        &self,
        token: &AuthToken,
        remote_path: &str,
        content: &[u8],
    ) -> SyncResult<RemoteFile> {
        #[derive(Serialize)]
        struct UploadArg<'a> {
            path: &'a str,
            mode: &'a str,
            autorename: bool,
        }
        let arg = serde_json::to_string(&UploadArg {
            path: remote_path,
            mode: "overwrite",
            autorename: false,
        })
        .map_err(|e| SyncError::Network(e.to_string()))?;

        let resp = self
            .http
            .post("https://content.dropboxapi.com/2/files/upload")
            .bearer_auth(&token.access_token)
            .header("Dropbox-API-Arg", &arg)
            .header("Content-Type", "application/octet-stream")
            .body(content.to_vec())
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let msg = resp.text().await.unwrap_or_default();
            return Err(SyncError::Api {
                status,
                message: msg,
            });
        }

        let meta: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;
        let hash = meta
            .get("content_hash")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        Ok(RemoteFile {
            path: remote_path.to_string(),
            hash,
            size: content.len() as u64,
            modified_at: Utc::now(),
        })
    }

    async fn delete_file(&self, token: &AuthToken, remote_path: &str) -> SyncResult<()> {
        let resp = self
            .http
            .post("https://api.dropboxapi.com/2/files/delete_v2")
            .bearer_auth(&token.access_token)
            .json(&serde_json::json!({ "path": remote_path }))
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if resp.status().is_success() || resp.status().as_u16() == 409 {
            return Ok(());
        }
        let status = resp.status().as_u16();
        let msg = resp.text().await.unwrap_or_default();
        Err(SyncError::Api {
            status,
            message: msg,
        })
    }

    async fn create_directory(&self, token: &AuthToken, remote_path: &str) -> SyncResult<()> {
        let resp = self
            .http
            .post("https://api.dropboxapi.com/2/files/create_folder_v2")
            .bearer_auth(&token.access_token)
            .json(&serde_json::json!({ "path": remote_path, "autorename": false }))
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if resp.status().is_success() || resp.status().as_u16() == 409 {
            return Ok(());
        }
        let status = resp.status().as_u16();
        let msg = resp.text().await.unwrap_or_default();
        Err(SyncError::Api {
            status,
            message: msg,
        })
    }
}

fn build_auth_token(resp: TokenResponse, keep_refresh: Option<String>) -> AuthToken {
    let expires_at = resp
        .expires_in
        .map(|secs| Utc::now() + chrono::Duration::seconds(secs as i64));
    AuthToken {
        access_token: resp.access_token,
        refresh_token: resp.refresh_token.or(keep_refresh),
        expires_at,
        token_type: resp.token_type,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider::SyncProvider;
    use crate::types::SyncProviderType;

    #[test]
    fn new_provider_has_no_credentials() {
        let p = DropboxProvider::new();
        assert!(!p.has_credentials());
    }

    #[test]
    fn with_credentials_sets_has_credentials() {
        let p = DropboxProvider::with_credentials(
            "my_app_key".to_string(),
            "my_app_secret".to_string(),
        );
        assert!(p.has_credentials());
    }

    #[test]
    fn with_env_credentials_reads_env_vars() {
        std::env::set_var("DROPBOX_CLIENT_ID", "env_key");
        std::env::set_var("DROPBOX_CLIENT_SECRET", "env_secret");
        let p = DropboxProvider::with_env_credentials();
        assert!(p.has_credentials());
        std::env::remove_var("DROPBOX_CLIENT_ID");
        std::env::remove_var("DROPBOX_CLIENT_SECRET");
    }

    #[test]
    fn metadata_methods_return_correct_values() {
        let p = DropboxProvider::new();
        assert_eq!(p.name(), "dropbox");
        assert_eq!(p.provider_type(), SyncProviderType::Dropbox);
        assert_eq!(p.display_name(), "Dropbox");
    }

    #[test]
    fn auth_url_with_credentials_contains_client_id() {
        let p = DropboxProvider::with_credentials("dropbox_key_789".to_string(), "sec".to_string());
        let url = p.auth_url();
        assert!(url.contains("dropbox_key_789"));
        assert!(url.contains("dropbox.com"));
        assert!(url.contains("response_type=code"));
    }

    #[test]
    fn auth_url_without_credentials_uses_not_configured() {
        let p = DropboxProvider::new();
        let url = p.auth_url();
        assert!(url.contains("NOT_CONFIGURED"));
    }

    #[test]
    fn require_credentials_without_creds_returns_error() {
        let p = DropboxProvider::new();
        assert!(p.require_credentials().is_err());
    }

    #[test]
    fn require_credentials_with_creds_returns_ok() {
        let p = DropboxProvider::with_credentials("key".to_string(), "secret".to_string());
        let (key, sec) = p.require_credentials().unwrap();
        assert_eq!(key, "key");
        assert_eq!(sec, "secret");
    }

    #[test]
    fn default_impl_matches_new() {
        let p = DropboxProvider::default();
        assert!(!p.has_credentials());
    }
}

use async_trait::async_trait;
use chrono::Utc;
use serde::Deserialize;

use crate::error::{SyncError, SyncResult};
use crate::provider::SyncProvider;
use crate::types::{AuthToken, RemoteFile, SyncProviderType};

const TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT: &str = "https://www.googleapis.com/oauth2/v2/userinfo";
const REDIRECT_URI: &str = "http://localhost:19876/callback";
const FILES_ENDPOINT: &str = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_ENDPOINT: &str =
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    token_type: String,
    expires_in: Option<u64>,
    refresh_token: Option<String>,
}

#[derive(Deserialize)]
struct UserInfo {
    email: Option<String>,
}

pub struct GoogleDriveProvider {
    client_id: Option<String>,
    client_secret: Option<String>,
    http: reqwest::Client,
}

impl Default for GoogleDriveProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl GoogleDriveProvider {
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
            client_id: std::env::var("GOOGLE_CLIENT_ID")
                .ok()
                .or_else(|| option_env!("GOOGLE_CLIENT_ID").map(str::to_string)),
            client_secret: std::env::var("GOOGLE_CLIENT_SECRET")
                .ok()
                .or_else(|| option_env!("GOOGLE_CLIENT_SECRET").map(str::to_string)),
            http: reqwest::Client::new(),
        }
    }

    /// Encontra ou cria uma pasta pelo nome sob um parent. Retorna o ID da pasta.
    async fn find_or_create_folder(
        &self,
        token: &AuthToken,
        name: &str,
        parent_id: Option<&str>,
    ) -> SyncResult<String> {
        let parent_filter = match parent_id {
            Some(pid) => format!(" and '{}' in parents", pid),
            None => " and 'root' in parents".to_string(),
        };
        let query = format!(
            "name='{}' and mimeType='application/vnd.google-apps.folder' and trashed=false{}",
            name.replace('\'', "\\'"),
            parent_filter
        );

        let search = self
            .http
            .get(FILES_ENDPOINT)
            .bearer_auth(&token.access_token)
            .query(&[("q", &query), ("fields", &"files(id)".to_string())])
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if search.status().is_success() {
            let result: serde_json::Value = search.json().await.unwrap_or(serde_json::Value::Null);
            if let Some(id) = result
                .get("files")
                .and_then(|f| f.as_array())
                .and_then(|a| a.first())
                .and_then(|f| f.get("id"))
                .and_then(|v| v.as_str())
            {
                return Ok(id.to_string());
            }
        }

        let body = match parent_id {
            Some(pid) => serde_json::json!({
                "name": name,
                "mimeType": "application/vnd.google-apps.folder",
                "parents": [pid]
            }),
            None => serde_json::json!({
                "name": name,
                "mimeType": "application/vnd.google-apps.folder"
            }),
        };

        let resp = self
            .http
            .post(FILES_ENDPOINT)
            .bearer_auth(&token.access_token)
            .json(&body)
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

        let created: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;
        created
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| SyncError::Network("No folder ID in Drive response".to_string()))
    }

    /// Garante que um caminho de pastas existe, criando se necessário. Retorna ID da pasta final.
    async fn ensure_folder_path(&self, token: &AuthToken, parts: &[&str]) -> SyncResult<String> {
        let mut parent: Option<String> = None;
        for part in parts {
            let id = self
                .find_or_create_folder(token, part, parent.as_deref())
                .await?;
            parent = Some(id);
        }
        parent.ok_or_else(|| SyncError::Network("Empty path parts".to_string()))
    }

    fn require_credentials(&self) -> SyncResult<(&str, &str)> {
        match (&self.client_id, &self.client_secret) {
            (Some(id), Some(secret)) => Ok((id.as_str(), secret.as_str())),
            _ => Err(SyncError::AuthFailed {
                message: "Google Drive não configurado. Defina GOOGLE_CLIENT_ID e \
                          GOOGLE_CLIENT_SECRET nas variáveis de ambiente."
                    .to_string(),
            }),
        }
    }

    #[cfg(test)]
    pub fn client_id_for_test(&self) -> Option<&str> {
        self.client_id.as_deref()
    }

    /// Lists files (non-folders) directly inside `folder_id`, returning paths prefixed by `prefix`.
    async fn list_files_in_folder(
        &self,
        token: &AuthToken,
        folder_id: &str,
        prefix: &str,
    ) -> SyncResult<Vec<RemoteFile>> {
        let query = format!(
            "'{}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false",
            folder_id
        );
        let resp = self
            .http
            .get(FILES_ENDPOINT)
            .bearer_auth(&token.access_token)
            .query(&[
                ("q", query.as_str()),
                ("fields", "files(id,name,size,modifiedTime)"),
            ])
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

        let result: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        Ok(result
            .get("files")
            .and_then(|f| f.as_array())
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|f| {
                let id = f.get("id")?.as_str()?.to_string();
                let name = f.get("name")?.as_str()?.to_string();
                let size = f
                    .get("size")
                    .and_then(|s| s.as_str())
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);
                let modified_at = f
                    .get("modifiedTime")
                    .and_then(|v| v.as_str())
                    .and_then(|s| s.parse::<chrono::DateTime<Utc>>().ok())
                    .unwrap_or_else(Utc::now);
                Some(RemoteFile {
                    path: format!("{}/{}", prefix.trim_end_matches('/'), name),
                    hash: id,
                    size,
                    modified_at,
                })
            })
            .collect())
    }

    /// Recursively lists all files under `folder_id`, accumulating into `out`.
    async fn list_files_recursive(
        &self,
        token: &AuthToken,
        folder_id: &str,
        prefix: &str,
        out: &mut Vec<RemoteFile>,
    ) -> SyncResult<()> {
        let files = self.list_files_in_folder(token, folder_id, prefix).await?;
        out.extend(files);

        let query = format!(
            "'{}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
            folder_id
        );
        let resp = self
            .http
            .get(FILES_ENDPOINT)
            .bearer_auth(&token.access_token)
            .query(&[("q", query.as_str()), ("fields", "files(id,name)")])
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if !resp.status().is_success() {
            return Ok(());
        }

        let result: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        let subdirs: Vec<(String, String)> = result
            .get("files")
            .and_then(|f| f.as_array())
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|f| {
                let id = f.get("id")?.as_str()?.to_string();
                let name = f.get("name")?.as_str()?.to_string();
                Some((id, name))
            })
            .collect();

        for (sub_id, sub_name) in subdirs {
            let sub_prefix = format!("{}/{}", prefix.trim_end_matches('/'), sub_name);
            Box::pin(self.list_files_recursive(token, &sub_id, &sub_prefix, out)).await?;
        }

        Ok(())
    }
}

#[async_trait]
impl SyncProvider for GoogleDriveProvider {
    fn name(&self) -> &str {
        "google_drive"
    }

    fn provider_type(&self) -> SyncProviderType {
        SyncProviderType::GoogleDrive
    }

    fn display_name(&self) -> &str {
        "Google Drive"
    }

    fn has_credentials(&self) -> bool {
        self.client_id.is_some() && self.client_secret.is_some()
    }

    fn auth_url(&self) -> String {
        let client_id = self.client_id.as_deref().unwrap_or("NOT_CONFIGURED");
        format!(
            "https://accounts.google.com/o/oauth2/v2/auth?\
             client_id={client_id}&\
             redirect_uri={REDIRECT_URI}&\
             response_type=code&\
             scope=https://www.googleapis.com/auth/drive.file&\
             access_type=offline&\
             prompt=consent"
        )
    }

    async fn exchange_code(&self, code: &str) -> SyncResult<AuthToken> {
        let (client_id, client_secret) = self.require_credentials()?;

        let resp = self
            .http
            .post(TOKEN_ENDPOINT)
            .form(&[
                ("code", code),
                ("client_id", client_id),
                ("client_secret", client_secret),
                ("redirect_uri", REDIRECT_URI),
                ("grant_type", "authorization_code"),
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
                message: "Sem refresh token para Google Drive".to_string(),
            })?;

        let resp = self
            .http
            .post(TOKEN_ENDPOINT)
            .form(&[
                ("refresh_token", refresh),
                ("client_id", client_id),
                ("client_secret", client_secret),
                ("grant_type", "refresh_token"),
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
            .post("https://oauth2.googleapis.com/revoke")
            .form(&[("token", token.access_token.as_str())])
            .send()
            .await;
        Ok(())
    }

    async fn get_user_email(&self, token: &AuthToken) -> SyncResult<Option<String>> {
        let resp = self
            .http
            .get(USERINFO_ENDPOINT)
            .bearer_auth(&token.access_token)
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if !resp.status().is_success() {
            return Ok(None);
        }

        let info: UserInfo = resp
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
        let parts: Vec<&str> = remote_path.split('/').filter(|s| !s.is_empty()).collect();
        let folder_id = self.ensure_folder_path(token, &parts).await?;
        self.list_files_in_folder(token, &folder_id, remote_path)
            .await
    }

    async fn list_all_remote_files(
        &self,
        token: &AuthToken,
        root_path: &str,
    ) -> SyncResult<Vec<RemoteFile>> {
        let parts: Vec<&str> = root_path.split('/').filter(|s| !s.is_empty()).collect();
        let folder_id = self.ensure_folder_path(token, &parts).await?;
        let mut all = Vec::new();
        self.list_files_recursive(token, &folder_id, root_path, &mut all)
            .await?;
        Ok(all)
    }

    async fn list_remote_folders(
        &self,
        token: &AuthToken,
        parent_path: &str,
    ) -> SyncResult<Vec<String>> {
        let parts: Vec<&str> = parent_path.split('/').filter(|s| !s.is_empty()).collect();
        let folder_id = self.ensure_folder_path(token, &parts).await?;
        let query = format!(
            "'{}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
            folder_id
        );
        let resp = self
            .http
            .get(FILES_ENDPOINT)
            .bearer_auth(&token.access_token)
            .query(&[("q", query.as_str()), ("fields", "files(id,name)")])
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if !resp.status().is_success() {
            return Ok(Vec::new());
        }

        let result: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;
        Ok(result
            .get("files")
            .and_then(|f| f.as_array())
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|f| f.get("name")?.as_str().map(str::to_string))
            .collect())
    }

    async fn download_file(&self, token: &AuthToken, file_id: &str) -> SyncResult<Vec<u8>> {
        let resp = self
            .http
            .get(format!("{}/{}?alt=media", FILES_ENDPOINT, file_id))
            .bearer_auth(&token.access_token)
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

    async fn download_remote_file(
        &self,
        token: &AuthToken,
        remote: &RemoteFile,
    ) -> SyncResult<Vec<u8>> {
        self.download_file(token, &remote.hash).await
    }

    async fn upload_file(
        &self,
        token: &AuthToken,
        remote_path: &str,
        content: &[u8],
    ) -> SyncResult<RemoteFile> {
        let parts: Vec<&str> = remote_path.split('/').collect();
        let (folder_parts, filename) = if parts.len() > 1 {
            (&parts[..parts.len() - 1], parts[parts.len() - 1])
        } else {
            (&parts[..0], parts[0])
        };

        let parent_id = if !folder_parts.is_empty() {
            Some(self.ensure_folder_path(token, folder_parts).await?)
        } else {
            None
        };

        let metadata = match &parent_id {
            Some(pid) => serde_json::json!({ "name": filename, "parents": [pid] }),
            None => serde_json::json!({ "name": filename }),
        };
        let metadata_str = serde_json::to_string(&metadata).unwrap_or_default();
        let boundary = "boundary__opennote__sync";

        let mut body = format!(
            "--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{metadata_str}\r\n\
             --{boundary}\r\nContent-Type: application/octet-stream\r\n\r\n"
        )
        .into_bytes();
        body.extend_from_slice(content);
        body.extend_from_slice(format!("\r\n--{boundary}--").as_bytes());

        let resp = self
            .http
            .post(UPLOAD_ENDPOINT)
            .bearer_auth(&token.access_token)
            .header(
                "Content-Type",
                format!("multipart/related; boundary={boundary}"),
            )
            .body(body)
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

        let created: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;
        let id = created
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

        Ok(RemoteFile {
            path: remote_path.to_string(),
            hash: id,
            size: content.len() as u64,
            modified_at: Utc::now(),
        })
    }

    async fn delete_file(&self, token: &AuthToken, remote_path: &str) -> SyncResult<()> {
        let resp = self
            .http
            .delete(format!("{}/{}", FILES_ENDPOINT, remote_path))
            .bearer_auth(&token.access_token)
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if resp.status().is_success() || resp.status().as_u16() == 404 {
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
        let parts: Vec<&str> = remote_path.split('/').filter(|s| !s.is_empty()).collect();
        self.ensure_folder_path(token, &parts).await?;
        Ok(())
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
        let p = GoogleDriveProvider::new();
        assert!(!p.has_credentials());
        assert!(p.client_id_for_test().is_none());
    }

    #[test]
    fn with_credentials_sets_has_credentials() {
        let p = GoogleDriveProvider::with_credentials(
            "my_client_id".to_string(),
            "my_secret".to_string(),
        );
        assert!(p.has_credentials());
        assert_eq!(p.client_id_for_test(), Some("my_client_id"));
    }

    #[test]
    fn with_env_credentials_reads_env_vars() {
        std::env::set_var("GOOGLE_CLIENT_ID", "env_id");
        std::env::set_var("GOOGLE_CLIENT_SECRET", "env_secret");
        let p = GoogleDriveProvider::with_env_credentials();
        assert!(p.has_credentials());
        std::env::remove_var("GOOGLE_CLIENT_ID");
        std::env::remove_var("GOOGLE_CLIENT_SECRET");
    }

    #[test]
    fn metadata_methods_return_correct_values() {
        let p = GoogleDriveProvider::new();
        assert_eq!(p.name(), "google_drive");
        assert_eq!(p.provider_type(), SyncProviderType::GoogleDrive);
        assert_eq!(p.display_name(), "Google Drive");
    }

    #[test]
    fn auth_url_with_credentials_contains_client_id() {
        let p = GoogleDriveProvider::with_credentials(
            "test_client_123".to_string(),
            "secret".to_string(),
        );
        let url = p.auth_url();
        assert!(url.contains("test_client_123"));
        assert!(url.contains("accounts.google.com"));
        assert!(url.contains("response_type=code"));
    }

    #[test]
    fn auth_url_without_credentials_uses_not_configured() {
        let p = GoogleDriveProvider::new();
        let url = p.auth_url();
        assert!(url.contains("NOT_CONFIGURED"));
    }

    #[test]
    fn require_credentials_without_creds_returns_error() {
        let p = GoogleDriveProvider::new();
        assert!(p.require_credentials().is_err());
    }

    #[test]
    fn require_credentials_with_creds_returns_ok() {
        let p = GoogleDriveProvider::with_credentials("id".to_string(), "sec".to_string());
        let (id, sec) = p.require_credentials().unwrap();
        assert_eq!(id, "id");
        assert_eq!(sec, "sec");
    }

    #[test]
    fn default_impl_matches_new() {
        let p = GoogleDriveProvider::default();
        assert!(!p.has_credentials());
    }
}

use async_trait::async_trait;
use chrono::Utc;
use serde::Deserialize;

use crate::error::{SyncError, SyncResult};
use crate::provider::SyncProvider;
use crate::types::{AuthToken, RemoteFile, SyncProviderType};

const TOKEN_ENDPOINT: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const REDIRECT_URI: &str = "http://localhost:19876/callback";

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    token_type: String,
    expires_in: Option<u64>,
    refresh_token: Option<String>,
}

#[derive(Deserialize)]
struct MeInfo {
    #[serde(rename = "userPrincipalName")]
    user_principal_name: Option<String>,
    mail: Option<String>,
}

pub struct OneDriveProvider {
    client_id: Option<String>,
    http: reqwest::Client,
}

impl Default for OneDriveProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl OneDriveProvider {
    pub fn new() -> Self {
        Self {
            client_id: None,
            http: reqwest::Client::new(),
        }
    }

    pub fn with_credentials(client_id: String) -> Self {
        Self {
            client_id: Some(client_id),
            http: reqwest::Client::new(),
        }
    }

    /// Runtime (dev) → compile-time baked (prod).
    /// OneDrive usa PKCE (public client) — sem client_secret.
    pub fn with_env_credentials() -> Self {
        Self {
            client_id: std::env::var("ONEDRIVE_CLIENT_ID")
                .ok()
                .or_else(|| option_env!("ONEDRIVE_CLIENT_ID").map(str::to_string)),
            http: reqwest::Client::new(),
        }
    }

    fn require_client_id(&self) -> SyncResult<&str> {
        self.client_id
            .as_deref()
            .ok_or_else(|| SyncError::AuthFailed {
                message:
                    "OneDrive não configurado. Defina ONEDRIVE_CLIENT_ID nas variáveis de ambiente."
                        .to_string(),
            })
    }

    /// Lists items under `remote_path`. If `recursive=true`, traverses subdirectories.
    async fn list_items(
        &self,
        token: &AuthToken,
        remote_path: &str,
        recursive: bool,
    ) -> SyncResult<Vec<RemoteFile>> {
        let url = format!(
            "https://graph.microsoft.com/v1.0/me/drive/approot:/{}:/children",
            remote_path.trim_matches('/')
        );

        let resp = self
            .http
            .get(&url)
            .bearer_auth(&token.access_token)
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let msg = resp.text().await.unwrap_or_default();
            return Err(SyncError::Api { status, message: msg });
        }

        let result: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        let items = result
            .get("value")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let mut all = Vec::new();
        for item in items {
            let name = item
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let item_path = format!("{}/{}", remote_path.trim_end_matches('/'), name);

            if item.get("folder").is_some() {
                if recursive {
                    let mut sub = Box::pin(self.list_items(token, &item_path, true)).await?;
                    all.append(&mut sub);
                }
            } else if item.get("file").is_some() {
                let size = item
                    .get("size")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0);
                let hash = item
                    .get("eTag")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let modified_at = item
                    .get("lastModifiedDateTime")
                    .and_then(|v| v.as_str())
                    .and_then(|s| s.parse::<chrono::DateTime<Utc>>().ok())
                    .unwrap_or_else(Utc::now);
                all.push(RemoteFile {
                    path: item_path,
                    hash,
                    size,
                    modified_at,
                });
            }
        }

        Ok(all)
    }
}

#[async_trait]
impl SyncProvider for OneDriveProvider {
    fn name(&self) -> &str {
        "onedrive"
    }

    fn provider_type(&self) -> SyncProviderType {
        SyncProviderType::OneDrive
    }

    fn display_name(&self) -> &str {
        "OneDrive"
    }

    fn auth_url(&self) -> String {
        let client_id = self.client_id.as_deref().unwrap_or("NOT_CONFIGURED");
        format!(
            "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?\
             client_id={client_id}&\
             redirect_uri={REDIRECT_URI}&\
             response_type=code&\
             scope=Files.ReadWrite.AppFolder%20offline_access%20User.Read"
        )
    }

    async fn exchange_code(&self, code: &str) -> SyncResult<AuthToken> {
        let client_id = self.require_client_id()?;

        let resp = self
            .http
            .post(TOKEN_ENDPOINT)
            .form(&[
                ("code", code),
                ("client_id", client_id),
                ("redirect_uri", REDIRECT_URI),
                ("grant_type", "authorization_code"),
                (
                    "scope",
                    "Files.ReadWrite.AppFolder offline_access User.Read",
                ),
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
        let client_id = self.require_client_id()?;

        let refresh = token
            .refresh_token
            .as_deref()
            .ok_or_else(|| SyncError::AuthFailed {
                message: "Sem refresh token para OneDrive".to_string(),
            })?;

        let resp = self
            .http
            .post(TOKEN_ENDPOINT)
            .form(&[
                ("refresh_token", refresh),
                ("client_id", client_id),
                ("grant_type", "refresh_token"),
                (
                    "scope",
                    "Files.ReadWrite.AppFolder offline_access User.Read",
                ),
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

    async fn revoke(&self, _token: &AuthToken) -> SyncResult<()> {
        Ok(())
    }

    async fn get_user_email(&self, token: &AuthToken) -> SyncResult<Option<String>> {
        let resp = self
            .http
            .get("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName")
            .bearer_auth(&token.access_token)
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if !resp.status().is_success() {
            return Ok(None);
        }

        let info: MeInfo = resp
            .json()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        Ok(info.mail.or(info.user_principal_name))
    }

    async fn list_remote_files(
        &self,
        token: &AuthToken,
        remote_path: &str,
    ) -> SyncResult<Vec<RemoteFile>> {
        self.list_items(token, remote_path, false).await
    }

    async fn list_all_remote_files(
        &self,
        token: &AuthToken,
        root_path: &str,
    ) -> SyncResult<Vec<RemoteFile>> {
        self.list_items(token, root_path, true).await
    }

    async fn list_remote_folders(
        &self,
        token: &AuthToken,
        parent_path: &str,
    ) -> SyncResult<Vec<String>> {
        let url = format!(
            "https://graph.microsoft.com/v1.0/me/drive/approot:/{}:/children",
            parent_path.trim_matches('/')
        );
        let resp = self
            .http
            .get(&url)
            .bearer_auth(&token.access_token)
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
            .get("value")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .filter(|item| item.get("folder").is_some())
            .filter_map(|item| item.get("name")?.as_str().map(str::to_string))
            .collect())
    }

    async fn download_file(&self, token: &AuthToken, remote_path: &str) -> SyncResult<Vec<u8>> {
        let url = format!(
            "https://graph.microsoft.com/v1.0/me/drive/approot:/{}:/content",
            remote_path.trim_matches('/')
        );
        let resp = self
            .http
            .get(&url)
            .bearer_auth(&token.access_token)
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let msg = resp.text().await.unwrap_or_default();
            return Err(SyncError::Api { status, message: msg });
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
        let url = format!(
            "https://graph.microsoft.com/v1.0/me/drive/approot:/{}:/content",
            remote_path.trim_matches('/')
        );
        let resp = self
            .http
            .put(&url)
            .bearer_auth(&token.access_token)
            .header("Content-Type", "application/octet-stream")
            .body(content.to_vec())
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let msg = resp.text().await.unwrap_or_default();
            return Err(SyncError::Api { status, message: msg });
        }

        let meta: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;
        let hash = meta
            .get("eTag")
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
        let url = format!(
            "https://graph.microsoft.com/v1.0/me/drive/approot:/{}",
            remote_path.trim_matches('/')
        );
        let resp = self
            .http
            .delete(&url)
            .bearer_auth(&token.access_token)
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if resp.status().is_success() || resp.status().as_u16() == 404 {
            return Ok(());
        }
        let status = resp.status().as_u16();
        let msg = resp.text().await.unwrap_or_default();
        Err(SyncError::Api { status, message: msg })
    }

    async fn create_directory(&self, token: &AuthToken, remote_path: &str) -> SyncResult<()> {
        let path = remote_path.trim_matches('/');
        let (parent, name) = match path.rfind('/') {
            Some(i) => (&path[..i], &path[i + 1..]),
            None => ("", path),
        };
        let url = if parent.is_empty() {
            "https://graph.microsoft.com/v1.0/me/drive/approot:/children".to_string()
        } else {
            format!(
                "https://graph.microsoft.com/v1.0/me/drive/approot:/{}:/children",
                parent
            )
        };
        let resp = self
            .http
            .post(&url)
            .bearer_auth(&token.access_token)
            .json(&serde_json::json!({
                "name": name,
                "folder": {},
                "@microsoft.graph.conflictBehavior": "replace"
            }))
            .send()
            .await
            .map_err(|e| SyncError::Network(e.to_string()))?;

        if resp.status().is_success() {
            return Ok(());
        }
        let status = resp.status().as_u16();
        let msg = resp.text().await.unwrap_or_default();
        Err(SyncError::Api { status, message: msg })
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

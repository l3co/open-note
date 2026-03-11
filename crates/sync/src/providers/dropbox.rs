use async_trait::async_trait;
use chrono::Utc;
use serde::Deserialize;

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
        _token: &AuthToken,
        _remote_path: &str,
    ) -> SyncResult<Vec<RemoteFile>> {
        Err(SyncError::AuthRequired {
            provider: "dropbox".to_string(),
        })
    }

    async fn download_file(&self, _token: &AuthToken, _remote_path: &str) -> SyncResult<Vec<u8>> {
        Err(SyncError::AuthRequired {
            provider: "dropbox".to_string(),
        })
    }

    async fn upload_file(
        &self,
        _token: &AuthToken,
        _remote_path: &str,
        _content: &[u8],
    ) -> SyncResult<RemoteFile> {
        Err(SyncError::AuthRequired {
            provider: "dropbox".to_string(),
        })
    }

    async fn delete_file(&self, _token: &AuthToken, _remote_path: &str) -> SyncResult<()> {
        Err(SyncError::AuthRequired {
            provider: "dropbox".to_string(),
        })
    }

    async fn create_directory(&self, _token: &AuthToken, _remote_path: &str) -> SyncResult<()> {
        Err(SyncError::AuthRequired {
            provider: "dropbox".to_string(),
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

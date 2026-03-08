use async_trait::async_trait;

use crate::error::{SyncError, SyncResult};
use crate::provider::SyncProvider;
use crate::types::{AuthToken, RemoteFile, SyncProviderType};

pub struct GoogleDriveProvider {
    client_id: Option<String>,
    #[allow(dead_code)]
    client_secret: Option<String>,
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
        }
    }

    pub fn with_credentials(client_id: String, client_secret: String) -> Self {
        Self {
            client_id: Some(client_id),
            client_secret: Some(client_secret),
        }
    }

    fn require_credentials(&self) -> SyncResult<(&str, &str)> {
        match (&self.client_id, &self.client_secret) {
            (Some(id), Some(secret)) => Ok((id.as_str(), secret.as_str())),
            _ => Err(SyncError::AuthFailed {
                message: "Google Drive OAuth credentials not configured".to_string(),
            }),
        }
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

    fn auth_url(&self) -> String {
        let client_id = self.client_id.as_deref().unwrap_or("NOT_CONFIGURED");
        format!(
            "https://accounts.google.com/o/oauth2/v2/auth?\
             client_id={client_id}&\
             redirect_uri=http://localhost:19876/callback&\
             response_type=code&\
             scope=https://www.googleapis.com/auth/drive.file&\
             access_type=offline&\
             prompt=consent"
        )
    }

    async fn exchange_code(&self, _code: &str) -> SyncResult<AuthToken> {
        self.require_credentials()?;
        Err(SyncError::AuthFailed {
            message: "Google Drive OAuth not yet configured. Register an OAuth app and provide client_id/client_secret.".to_string(),
        })
    }

    async fn refresh_token(&self, _token: &AuthToken) -> SyncResult<AuthToken> {
        self.require_credentials()?;
        Err(SyncError::AuthFailed {
            message: "Google Drive token refresh not yet configured".to_string(),
        })
    }

    async fn revoke(&self, _token: &AuthToken) -> SyncResult<()> {
        Ok(())
    }

    async fn get_user_email(&self, _token: &AuthToken) -> SyncResult<Option<String>> {
        Ok(None)
    }

    async fn list_remote_files(
        &self,
        _token: &AuthToken,
        _remote_path: &str,
    ) -> SyncResult<Vec<RemoteFile>> {
        Err(SyncError::AuthRequired {
            provider: "google_drive".to_string(),
        })
    }

    async fn download_file(&self, _token: &AuthToken, _remote_path: &str) -> SyncResult<Vec<u8>> {
        Err(SyncError::AuthRequired {
            provider: "google_drive".to_string(),
        })
    }

    async fn upload_file(
        &self,
        _token: &AuthToken,
        _remote_path: &str,
        _content: &[u8],
    ) -> SyncResult<RemoteFile> {
        Err(SyncError::AuthRequired {
            provider: "google_drive".to_string(),
        })
    }

    async fn delete_file(&self, _token: &AuthToken, _remote_path: &str) -> SyncResult<()> {
        Err(SyncError::AuthRequired {
            provider: "google_drive".to_string(),
        })
    }

    async fn create_directory(&self, _token: &AuthToken, _remote_path: &str) -> SyncResult<()> {
        Err(SyncError::AuthRequired {
            provider: "google_drive".to_string(),
        })
    }
}

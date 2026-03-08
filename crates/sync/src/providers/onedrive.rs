use async_trait::async_trait;

use crate::error::{SyncError, SyncResult};
use crate::provider::SyncProvider;
use crate::types::{AuthToken, RemoteFile, SyncProviderType};

pub struct OneDriveProvider {
    client_id: Option<String>,
}

impl Default for OneDriveProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl OneDriveProvider {
    pub fn new() -> Self {
        Self { client_id: None }
    }

    pub fn with_credentials(client_id: String) -> Self {
        Self {
            client_id: Some(client_id),
        }
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
             redirect_uri=http://localhost:19876/callback&\
             response_type=code&\
             scope=Files.ReadWrite.AppFolder%20offline_access"
        )
    }

    async fn exchange_code(&self, _code: &str) -> SyncResult<AuthToken> {
        Err(SyncError::AuthFailed {
            message: "OneDrive OAuth not yet configured".to_string(),
        })
    }

    async fn refresh_token(&self, _token: &AuthToken) -> SyncResult<AuthToken> {
        Err(SyncError::AuthFailed {
            message: "OneDrive token refresh not yet configured".to_string(),
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
            provider: "onedrive".to_string(),
        })
    }

    async fn download_file(&self, _token: &AuthToken, _remote_path: &str) -> SyncResult<Vec<u8>> {
        Err(SyncError::AuthRequired {
            provider: "onedrive".to_string(),
        })
    }

    async fn upload_file(
        &self,
        _token: &AuthToken,
        _remote_path: &str,
        _content: &[u8],
    ) -> SyncResult<RemoteFile> {
        Err(SyncError::AuthRequired {
            provider: "onedrive".to_string(),
        })
    }

    async fn delete_file(&self, _token: &AuthToken, _remote_path: &str) -> SyncResult<()> {
        Err(SyncError::AuthRequired {
            provider: "onedrive".to_string(),
        })
    }

    async fn create_directory(&self, _token: &AuthToken, _remote_path: &str) -> SyncResult<()> {
        Err(SyncError::AuthRequired {
            provider: "onedrive".to_string(),
        })
    }
}

use async_trait::async_trait;

use crate::error::SyncResult;
use crate::types::{AuthToken, RemoteFile, SyncProviderType};

#[async_trait]
pub trait SyncProvider: Send + Sync {
    fn name(&self) -> &str;

    fn provider_type(&self) -> SyncProviderType;

    fn display_name(&self) -> &str;

    fn auth_url(&self) -> String;

    async fn exchange_code(&self, code: &str) -> SyncResult<AuthToken>;

    async fn refresh_token(&self, token: &AuthToken) -> SyncResult<AuthToken>;

    async fn revoke(&self, token: &AuthToken) -> SyncResult<()>;

    async fn get_user_email(&self, token: &AuthToken) -> SyncResult<Option<String>>;

    async fn list_remote_files(
        &self,
        token: &AuthToken,
        remote_path: &str,
    ) -> SyncResult<Vec<RemoteFile>>;

    async fn download_file(&self, token: &AuthToken, remote_path: &str) -> SyncResult<Vec<u8>>;

    async fn upload_file(
        &self,
        token: &AuthToken,
        remote_path: &str,
        content: &[u8],
    ) -> SyncResult<RemoteFile>;

    async fn delete_file(&self, token: &AuthToken, remote_path: &str) -> SyncResult<()>;

    async fn create_directory(&self, token: &AuthToken, remote_path: &str) -> SyncResult<()>;
}

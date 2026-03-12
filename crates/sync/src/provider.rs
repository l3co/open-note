use async_trait::async_trait;

use crate::error::SyncResult;
use crate::types::{AuthToken, RemoteFile, SyncProviderType};

#[async_trait]
pub trait SyncProvider: Send + Sync {
    fn name(&self) -> &str;

    fn provider_type(&self) -> SyncProviderType;

    fn display_name(&self) -> &str;

    /// Returns true if OAuth credentials are available (either baked at compile
    /// time via `option_env!()` or provided via runtime env var).
    fn has_credentials(&self) -> bool;

    fn auth_url(&self) -> String;

    async fn exchange_code(&self, code: &str) -> SyncResult<AuthToken>;

    async fn refresh_token(&self, token: &AuthToken) -> SyncResult<AuthToken>;

    async fn revoke(&self, token: &AuthToken) -> SyncResult<()>;

    async fn get_user_email(&self, token: &AuthToken) -> SyncResult<Option<String>>;

    /// Lists files directly under `remote_path` (non-recursive).
    async fn list_remote_files(
        &self,
        token: &AuthToken,
        remote_path: &str,
    ) -> SyncResult<Vec<RemoteFile>>;

    /// Lists ALL files under `remote_path` recursively.
    /// Default implementation delegates to `list_remote_files` (non-recursive fallback).
    /// Providers with native recursive listing should override this.
    async fn list_all_remote_files(
        &self,
        token: &AuthToken,
        root_path: &str,
    ) -> SyncResult<Vec<RemoteFile>> {
        self.list_remote_files(token, root_path).await
    }

    /// Lists top-level folders (workspaces) inside `parent_path`.
    async fn list_remote_folders(
        &self,
        token: &AuthToken,
        parent_path: &str,
    ) -> SyncResult<Vec<String>>;

    /// Downloads a file by its remote path. For Google Drive, `remote_path` is the file ID.
    async fn download_file(&self, token: &AuthToken, remote_path: &str) -> SyncResult<Vec<u8>>;

    /// Downloads using a `RemoteFile` descriptor. Default uses `remote.path`.
    /// Google Drive overrides to use `remote.hash` (which is the Drive file ID).
    async fn download_remote_file(
        &self,
        token: &AuthToken,
        remote: &RemoteFile,
    ) -> SyncResult<Vec<u8>> {
        self.download_file(token, &remote.path).await
    }

    async fn upload_file(
        &self,
        token: &AuthToken,
        remote_path: &str,
        content: &[u8],
    ) -> SyncResult<RemoteFile>;

    async fn delete_file(&self, token: &AuthToken, remote_path: &str) -> SyncResult<()>;

    async fn create_directory(&self, token: &AuthToken, remote_path: &str) -> SyncResult<()>;
}

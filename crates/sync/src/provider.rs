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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::SyncResult;
    use crate::types::{AuthToken, RemoteFile, SyncProviderType};
    use async_trait::async_trait;
    use chrono::Utc;

    struct MockProvider;

    #[async_trait]
    impl SyncProvider for MockProvider {
        fn name(&self) -> &str {
            "mock"
        }
        fn provider_type(&self) -> SyncProviderType {
            SyncProviderType::GoogleDrive
        }
        fn display_name(&self) -> &str {
            "Mock"
        }
        fn has_credentials(&self) -> bool {
            true
        }
        fn auth_url(&self) -> String {
            "https://mock.example.com/auth".to_string()
        }
        async fn exchange_code(&self, _code: &str) -> SyncResult<AuthToken> {
            unimplemented!()
        }
        async fn refresh_token(&self, _token: &AuthToken) -> SyncResult<AuthToken> {
            unimplemented!()
        }
        async fn revoke(&self, _token: &AuthToken) -> SyncResult<()> {
            unimplemented!()
        }
        async fn get_user_email(&self, _token: &AuthToken) -> SyncResult<Option<String>> {
            unimplemented!()
        }
        async fn list_remote_files(
            &self,
            _token: &AuthToken,
            _remote_path: &str,
        ) -> SyncResult<Vec<RemoteFile>> {
            Ok(vec![RemoteFile {
                path: "file.txt".to_string(),
                hash: "abc".to_string(),
                size: 10,
                modified_at: Utc::now(),
            }])
        }
        async fn list_remote_folders(
            &self,
            _token: &AuthToken,
            _parent_path: &str,
        ) -> SyncResult<Vec<String>> {
            Ok(vec!["folder1".to_string()])
        }
        async fn download_file(
            &self,
            _token: &AuthToken,
            remote_path: &str,
        ) -> SyncResult<Vec<u8>> {
            Ok(remote_path.as_bytes().to_vec())
        }
        async fn upload_file(
            &self,
            _token: &AuthToken,
            _remote_path: &str,
            _content: &[u8],
        ) -> SyncResult<RemoteFile> {
            unimplemented!()
        }
        async fn delete_file(&self, _token: &AuthToken, _remote_path: &str) -> SyncResult<()> {
            unimplemented!()
        }
        async fn create_directory(
            &self,
            _token: &AuthToken,
            _remote_path: &str,
        ) -> SyncResult<()> {
            unimplemented!()
        }
    }

    fn dummy_token() -> AuthToken {
        AuthToken {
            access_token: "tok".to_string(),
            refresh_token: None,
            expires_at: None,
            token_type: "Bearer".to_string(),
        }
    }

    #[tokio::test]
    async fn default_list_all_remote_files_delegates_to_list_remote_files() {
        let provider = MockProvider;
        let token = dummy_token();
        let files = provider.list_all_remote_files(&token, "root").await.unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "file.txt");
    }

    #[tokio::test]
    async fn default_download_remote_file_delegates_to_download_file() {
        let provider = MockProvider;
        let token = dummy_token();
        let remote = RemoteFile {
            path: "my/file.txt".to_string(),
            hash: "hash".to_string(),
            size: 0,
            modified_at: Utc::now(),
        };
        let data = provider.download_remote_file(&token, &remote).await.unwrap();
        assert_eq!(data, b"my/file.txt");
    }
}

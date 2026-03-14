use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;

use chrono::Utc;

use crate::error::{SyncError, SyncResult};
use crate::manifest::{compute_hash, should_sync_file};
use crate::provider::SyncProvider;
use crate::types::{ConflictResolution, ProviderInfo, SyncConflict, SyncPreferences, SyncStatus};

pub struct SyncCoordinator {
    workspace_root: PathBuf,
    provider: Option<Box<dyn SyncProvider>>,
    preferences: SyncPreferences,
    status: SyncStatus,
    conflicts: Vec<SyncConflict>,
    #[allow(dead_code)]
    is_syncing: AtomicBool,
}

impl SyncCoordinator {
    pub fn new(workspace_root: PathBuf) -> Self {
        Self {
            workspace_root,
            provider: None,
            preferences: SyncPreferences::default(),
            status: SyncStatus::default(),
            conflicts: Vec::new(),
            is_syncing: AtomicBool::new(false),
        }
    }

    pub fn set_provider(&mut self, provider: Box<dyn SyncProvider>) {
        self.status.provider = Some(provider.name().to_string());
        self.provider = Some(provider);
    }

    pub fn clear_provider(&mut self) {
        self.provider = None;
        self.status.provider = None;
    }

    pub fn set_preferences(&mut self, prefs: SyncPreferences) {
        self.preferences = prefs;
    }

    pub fn get_preferences(&self) -> &SyncPreferences {
        &self.preferences
    }

    pub fn get_status(&self) -> &SyncStatus {
        &self.status
    }

    pub fn get_status_mut(&mut self) -> &mut SyncStatus {
        &mut self.status
    }

    pub fn get_conflicts(&self) -> &[SyncConflict] {
        &self.conflicts
    }

    pub fn add_conflict(&mut self, conflict: SyncConflict) {
        self.conflicts.push(conflict);
        self.status.pending_conflicts = self.conflicts.len() as u32;
    }

    pub fn get_provider_info(&self) -> Option<ProviderInfo> {
        self.provider.as_ref().map(|p| ProviderInfo {
            name: p.name().to_string(),
            display_name: p.display_name().to_string(),
            connected: self.preferences.enabled,
            user_email: None,
            last_synced_at: self.status.last_synced_at,
        })
    }

    pub fn manifest_path(&self) -> PathBuf {
        self.workspace_root
            .join(".opennote")
            .join("sync_manifest.json")
    }

    pub fn collect_local_files(
        &self,
    ) -> SyncResult<HashMap<String, (String, chrono::DateTime<Utc>)>> {
        let mut files = HashMap::new();
        self.walk_dir(&self.workspace_root, &self.workspace_root, &mut files)?;
        Ok(files)
    }

    fn walk_dir(
        &self,
        dir: &Path,
        root: &Path,
        files: &mut HashMap<String, (String, chrono::DateTime<Utc>)>,
    ) -> SyncResult<()> {
        if !dir.exists() {
            return Ok(());
        }

        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            let relative = path
                .strip_prefix(root)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");

            if !should_sync_file(&relative) {
                continue;
            }

            if path.is_dir() {
                self.walk_dir(&path, root, files)?;
            } else if path.is_file() {
                let content = std::fs::read(&path)?;
                let hash = compute_hash(&content);
                let modified = path
                    .metadata()?
                    .modified()
                    .unwrap_or(std::time::SystemTime::now());
                let modified_dt: chrono::DateTime<Utc> = modified.into();
                files.insert(relative, (hash, modified_dt));
            }
        }

        Ok(())
    }

    /// Derives the set of unique remote directory paths that must exist before
    /// uploading `file_paths`. Returns paths sorted shortest-first so parent
    /// directories are always created before their children.
    ///
    /// Example: `["nb/sec/page.json", "nb/sec2/page.json"]`
    /// → `["nb", "nb/sec", "nb/sec2"]`
    pub fn dirs_for_paths(file_paths: &[&str]) -> Vec<String> {
        let mut dirs = std::collections::BTreeSet::new();
        for path in file_paths {
            let parts: Vec<&str> = path.split('/').collect();
            for depth in 1..parts.len() {
                dirs.insert(parts[..depth].join("/"));
            }
        }
        dirs.into_iter().collect()
    }

    pub fn resolve_conflict(
        &mut self,
        conflict_id: &str,
        resolution: ConflictResolution,
    ) -> SyncResult<()> {
        let pos = self
            .conflicts
            .iter()
            .position(|c| c.id == conflict_id)
            .ok_or_else(|| SyncError::Storage(format!("Conflict not found: {conflict_id}")))?;

        let conflict = &self.conflicts[pos];

        match resolution {
            ConflictResolution::KeepLocal => {
                let conflict_file = self.workspace_root.join(&conflict.conflict_path);
                if conflict_file.exists() {
                    std::fs::remove_file(&conflict_file)?;
                }
            }
            ConflictResolution::KeepRemote => {
                let local_file = self.workspace_root.join(&conflict.local_path);
                let conflict_file = self.workspace_root.join(&conflict.conflict_path);
                if conflict_file.exists() {
                    std::fs::rename(&conflict_file, &local_file)?;
                }
            }
            ConflictResolution::KeepBoth => {}
        }

        self.conflicts.remove(pos);
        self.status.pending_conflicts = self.conflicts.len() as u32;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_coordinator_defaults() {
        let coord = SyncCoordinator::new(PathBuf::from("/tmp/test"));
        assert!(!coord.get_status().is_syncing);
        assert!(coord.get_status().provider.is_none());
        assert!(coord.get_conflicts().is_empty());
        assert!(!coord.get_preferences().enabled);
    }

    #[test]
    fn set_and_get_preferences() {
        let mut coord = SyncCoordinator::new(PathBuf::from("/tmp/test"));
        let prefs = SyncPreferences {
            enabled: true,
            provider: Some(crate::types::SyncProviderType::GoogleDrive),
            interval_seconds: 60,
            synced_notebook_ids: vec!["nb-1".to_string()],
        };
        coord.set_preferences(prefs.clone());
        assert!(coord.get_preferences().enabled);
        assert_eq!(coord.get_preferences().interval_seconds, 60);
    }

    // ─── dirs_for_paths ───

    #[test]
    fn dirs_for_paths_empty_list_returns_empty() {
        assert!(SyncCoordinator::dirs_for_paths(&[]).is_empty());
    }

    #[test]
    fn dirs_for_paths_root_file_returns_empty() {
        // A file at root level has no parent directory to create
        let dirs = SyncCoordinator::dirs_for_paths(&["workspace.json"]);
        assert!(dirs.is_empty());
    }

    #[test]
    fn dirs_for_paths_single_nested_file() {
        let dirs = SyncCoordinator::dirs_for_paths(&["notebook/section/page.opn.json"]);
        assert_eq!(dirs, vec!["notebook", "notebook/section"]);
    }

    #[test]
    fn dirs_for_paths_deduplicates_shared_parents() {
        let dirs = SyncCoordinator::dirs_for_paths(&[
            "notebook/sec1/page1.opn.json",
            "notebook/sec1/page2.opn.json",
            "notebook/sec2/page3.opn.json",
        ]);
        assert_eq!(
            dirs,
            vec!["notebook", "notebook/sec1", "notebook/sec2"]
        );
    }

    #[test]
    fn dirs_for_paths_sorted_shortest_first() {
        let dirs = SyncCoordinator::dirs_for_paths(&[
            "a/b/c/d.opn.json",
            "a/e.opn.json",
        ]);
        // BTreeSet gives lexicographic order; parents always shorter than children
        assert_eq!(dirs[0], "a");
        assert!(dirs.windows(2).all(|w| w[0].len() <= w[1].len() || w[0] < w[1]));
    }

    #[test]
    fn dirs_for_paths_multiple_notebooks() {
        let dirs = SyncCoordinator::dirs_for_paths(&[
            "NB-Alpha/sec/page.json",
            "NB-Beta/sec/page.json",
        ]);
        assert!(dirs.contains(&"NB-Alpha".to_string()));
        assert!(dirs.contains(&"NB-Beta".to_string()));
        assert!(dirs.contains(&"NB-Alpha/sec".to_string()));
        assert!(dirs.contains(&"NB-Beta/sec".to_string()));
        assert_eq!(dirs.len(), 4);
    }

    #[test]
    fn dirs_for_paths_deeply_nested() {
        let dirs = SyncCoordinator::dirs_for_paths(&["a/b/c/d/e/file.json"]);
        assert_eq!(
            dirs,
            vec!["a", "a/b", "a/b/c", "a/b/c/d", "a/b/c/d/e"]
        );
    }

    #[test]
    fn dirs_for_paths_mixed_depth() {
        let dirs = SyncCoordinator::dirs_for_paths(&[
            "root.json",
            "nb/page.json",
            "nb/sec/deep.json",
        ]);
        assert_eq!(dirs, vec!["nb", "nb/sec"]);
    }

    // ─── create_directory via mock provider ───

    use crate::types::{AuthToken, RemoteFile, SyncProviderType};
    use async_trait::async_trait;
    use std::sync::{Arc, Mutex};

    #[derive(Clone)]
    struct TrackingProvider {
        created_dirs: Arc<Mutex<Vec<String>>>,
    }

    impl TrackingProvider {
        fn new() -> Self {
            Self {
                created_dirs: Arc::new(Mutex::new(Vec::new())),
            }
        }
        fn created(&self) -> Vec<String> {
            self.created_dirs.lock().unwrap().clone()
        }
    }

    #[async_trait]
    impl SyncProvider for TrackingProvider {
        fn name(&self) -> &str { "tracking" }
        fn provider_type(&self) -> SyncProviderType { SyncProviderType::GoogleDrive }
        fn display_name(&self) -> &str { "Tracking" }
        fn has_credentials(&self) -> bool { true }
        fn auth_url(&self) -> String { String::new() }
        async fn exchange_code(&self, _: &str) -> crate::error::SyncResult<AuthToken> { unimplemented!() }
        async fn refresh_token(&self, _: &AuthToken) -> crate::error::SyncResult<AuthToken> { unimplemented!() }
        async fn revoke(&self, _: &AuthToken) -> crate::error::SyncResult<()> { Ok(()) }
        async fn get_user_email(&self, _: &AuthToken) -> crate::error::SyncResult<Option<String>> { Ok(None) }
        async fn list_remote_files(&self, _: &AuthToken, _: &str) -> crate::error::SyncResult<Vec<RemoteFile>> { Ok(vec![]) }
        async fn list_remote_folders(&self, _: &AuthToken, _: &str) -> crate::error::SyncResult<Vec<String>> { Ok(vec![]) }
        async fn download_file(&self, _: &AuthToken, _: &str) -> crate::error::SyncResult<Vec<u8>> { Ok(vec![]) }
        async fn upload_file(&self, _: &AuthToken, path: &str, content: &[u8]) -> crate::error::SyncResult<RemoteFile> {
            use chrono::Utc;
            Ok(RemoteFile { path: path.to_string(), hash: "h".to_string(), size: content.len() as u64, modified_at: Utc::now() })
        }
        async fn delete_file(&self, _: &AuthToken, _: &str) -> crate::error::SyncResult<()> { Ok(()) }
        async fn create_directory(&self, _: &AuthToken, path: &str) -> crate::error::SyncResult<()> {
            self.created_dirs.lock().unwrap().push(path.to_string());
            Ok(())
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
    async fn create_directory_called_for_each_parent_dir() {
        let provider = TrackingProvider::new();
        let token = dummy_token();

        // Simulate what sync would do: derive dirs then create them
        let files = [
            "notebook/section/page1.opn.json",
            "notebook/section/page2.opn.json",
            "notebook/section2/page3.opn.json",
        ];
        let dirs = SyncCoordinator::dirs_for_paths(&files);

        for dir in &dirs {
            provider.create_directory(&token, dir).await.unwrap();
        }

        let created = provider.created();
        assert!(created.contains(&"notebook".to_string()));
        assert!(created.contains(&"notebook/section".to_string()));
        assert!(created.contains(&"notebook/section2".to_string()));
        assert_eq!(created.len(), 3);
    }

    #[tokio::test]
    async fn create_directory_parent_before_child() {
        let provider = TrackingProvider::new();
        let token = dummy_token();

        let files = ["a/b/c/file.json"];
        let dirs = SyncCoordinator::dirs_for_paths(&files);

        for dir in &dirs {
            provider.create_directory(&token, dir).await.unwrap();
        }

        let created = provider.created();
        assert_eq!(created, vec!["a", "a/b", "a/b/c"]);

        // Verify parent is created before child
        let pos_a = created.iter().position(|d| d == "a").unwrap();
        let pos_ab = created.iter().position(|d| d == "a/b").unwrap();
        let pos_abc = created.iter().position(|d| d == "a/b/c").unwrap();
        assert!(pos_a < pos_ab);
        assert!(pos_ab < pos_abc);
    }

    #[tokio::test]
    async fn create_directory_root_file_creates_no_dirs() {
        let provider = TrackingProvider::new();
        let token = dummy_token();

        let files = ["workspace.json", "notebook.json"];
        let dirs = SyncCoordinator::dirs_for_paths(&files);

        for dir in &dirs {
            provider.create_directory(&token, dir).await.unwrap();
        }

        assert!(provider.created().is_empty());
    }

    #[tokio::test]
    async fn create_directory_deduplicates_shared_parents() {
        let provider = TrackingProvider::new();
        let token = dummy_token();

        let files = [
            "nb/sec/p1.json",
            "nb/sec/p2.json",
            "nb/sec/p3.json",
        ];
        let dirs = SyncCoordinator::dirs_for_paths(&files);

        for dir in &dirs {
            provider.create_directory(&token, dir).await.unwrap();
        }

        let created = provider.created();
        // "nb" and "nb/sec" should each appear exactly once
        assert_eq!(created.iter().filter(|d| d.as_str() == "nb").count(), 1);
        assert_eq!(created.iter().filter(|d| d.as_str() == "nb/sec").count(), 1);
        assert_eq!(created.len(), 2);
    }

    #[test]
    fn collect_local_files_from_temp_dir() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("notebook.json"), b"{}").unwrap();
        std::fs::create_dir_all(dir.path().join("section")).unwrap();
        std::fs::write(dir.path().join("section/page.opn.json"), b"{\"blocks\":[]}").unwrap();

        let coord = SyncCoordinator::new(dir.path().to_path_buf());
        let files = coord.collect_local_files().unwrap();

        assert!(files.contains_key("notebook.json"));
        assert!(files.contains_key("section/page.opn.json"));
    }

    #[test]
    fn collect_excludes_lock_and_trash() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(".lock"), b"123").unwrap();
        std::fs::create_dir_all(dir.path().join(".trash")).unwrap();
        std::fs::write(dir.path().join(".trash/item.json"), b"{}").unwrap();
        std::fs::write(dir.path().join("notebook.json"), b"{}").unwrap();

        let coord = SyncCoordinator::new(dir.path().to_path_buf());
        let files = coord.collect_local_files().unwrap();

        assert_eq!(files.len(), 1);
        assert!(files.contains_key("notebook.json"));
    }

    #[test]
    fn manifest_path_correct() {
        let coord = SyncCoordinator::new(PathBuf::from("/workspace"));
        assert_eq!(
            coord.manifest_path(),
            PathBuf::from("/workspace/.opennote/sync_manifest.json")
        );
    }

    // ─── Phase 4 Retrofit: Conflict Resolution ───

    fn make_conflict(dir: &Path, id: &str) -> SyncConflict {
        let local_path = format!("pages/{id}.opn.json");
        let conflict_path = format!("pages/{id}.conflict.opn.json");

        let local_file = dir.join(&local_path);
        let conflict_file = dir.join(&conflict_path);

        std::fs::create_dir_all(local_file.parent().unwrap()).unwrap();
        std::fs::write(&local_file, b"{\"local\": true}").unwrap();
        std::fs::write(&conflict_file, b"{\"remote\": true}").unwrap();

        SyncConflict {
            id: id.to_string(),
            page_title: format!("Page {id}"),
            local_modified_at: Utc::now(),
            remote_modified_at: Utc::now(),
            local_path,
            conflict_path,
        }
    }

    #[test]
    fn test_resolve_conflict_keep_local() {
        let dir = tempfile::tempdir().unwrap();
        let mut coord = SyncCoordinator::new(dir.path().to_path_buf());

        let conflict = make_conflict(dir.path(), "c1");
        let conflict_file = dir.path().join(&conflict.conflict_path);
        let local_file = dir.path().join(&conflict.local_path);
        coord.add_conflict(conflict);

        coord
            .resolve_conflict("c1", ConflictResolution::KeepLocal)
            .unwrap();

        assert!(!conflict_file.exists(), "Conflict file should be deleted");
        assert!(local_file.exists(), "Local file should remain");
        assert!(coord.get_conflicts().is_empty());
    }

    #[test]
    fn test_resolve_conflict_keep_remote() {
        let dir = tempfile::tempdir().unwrap();
        let mut coord = SyncCoordinator::new(dir.path().to_path_buf());

        let conflict = make_conflict(dir.path(), "c2");
        let local_file = dir.path().join(&conflict.local_path);
        coord.add_conflict(conflict);

        coord
            .resolve_conflict("c2", ConflictResolution::KeepRemote)
            .unwrap();

        assert!(
            local_file.exists(),
            "Local file should be replaced by remote"
        );
        let content = std::fs::read_to_string(&local_file).unwrap();
        assert!(
            content.contains("remote"),
            "Content should be from conflict (remote) file"
        );
        assert!(coord.get_conflicts().is_empty());
    }

    #[test]
    fn test_resolve_conflict_keep_both() {
        let dir = tempfile::tempdir().unwrap();
        let mut coord = SyncCoordinator::new(dir.path().to_path_buf());

        let conflict = make_conflict(dir.path(), "c3");
        let local_file = dir.path().join(&conflict.local_path);
        let conflict_file = dir.path().join(&conflict.conflict_path);
        coord.add_conflict(conflict);

        coord
            .resolve_conflict("c3", ConflictResolution::KeepBoth)
            .unwrap();

        assert!(local_file.exists(), "Local file should remain");
        assert!(conflict_file.exists(), "Conflict file should remain");
        assert!(coord.get_conflicts().is_empty());
    }

    #[test]
    fn test_resolve_conflict_nonexistent_id_returns_error() {
        let dir = tempfile::tempdir().unwrap();
        let mut coord = SyncCoordinator::new(dir.path().to_path_buf());

        let result = coord.resolve_conflict("fake-id", ConflictResolution::KeepLocal);
        assert!(result.is_err());
        let err = result.unwrap_err();
        let msg = err.to_string();
        assert!(
            msg.contains("Conflict not found"),
            "Error should mention 'Conflict not found', got: {msg}"
        );
    }

    #[test]
    fn test_resolve_conflict_updates_pending_count() {
        let dir = tempfile::tempdir().unwrap();
        let mut coord = SyncCoordinator::new(dir.path().to_path_buf());

        coord.add_conflict(make_conflict(dir.path(), "a"));
        coord.add_conflict(make_conflict(dir.path(), "b"));
        coord.add_conflict(make_conflict(dir.path(), "c"));
        assert_eq!(coord.get_status().pending_conflicts, 3);

        coord
            .resolve_conflict("b", ConflictResolution::KeepBoth)
            .unwrap();
        assert_eq!(coord.get_status().pending_conflicts, 2);
        assert_eq!(coord.get_conflicts().len(), 2);
    }
}

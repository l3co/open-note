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

    pub fn get_conflicts(&self) -> &[SyncConflict] {
        &self.conflicts
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
}

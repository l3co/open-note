use std::collections::HashMap;
use std::path::Path;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::SyncResult;
use crate::types::FileChange;
use crate::types::FileChangeKind;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SyncManifest {
    pub files: HashMap<String, SyncFileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncFileEntry {
    pub local_hash: String,
    pub remote_hash: String,
    pub local_modified_at: DateTime<Utc>,
    pub remote_modified_at: DateTime<Utc>,
    pub synced_at: DateTime<Utc>,
}

impl SyncManifest {
    pub fn load(manifest_path: &Path) -> SyncResult<Self> {
        if manifest_path.exists() {
            let data = std::fs::read_to_string(manifest_path)?;
            let manifest: Self = serde_json::from_str(&data)?;
            Ok(manifest)
        } else {
            Ok(Self::default())
        }
    }

    pub fn save(&self, manifest_path: &Path) -> SyncResult<()> {
        if let Some(parent) = manifest_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let data = serde_json::to_string_pretty(self)?;
        std::fs::write(manifest_path, data)?;
        Ok(())
    }

    pub fn update_entry(&mut self, path: &str, entry: SyncFileEntry) {
        self.files.insert(path.to_string(), entry);
    }

    pub fn remove_entry(&mut self, path: &str) {
        self.files.remove(path);
    }

    pub fn get_entry(&self, path: &str) -> Option<&SyncFileEntry> {
        self.files.get(path)
    }
}

pub fn compute_hash(content: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content);
    let result = hasher.finalize();
    format!("sha256:{:x}", result)
}

pub fn detect_changes(
    local_files: &HashMap<String, (String, DateTime<Utc>)>,
    remote_files: &HashMap<String, (String, DateTime<Utc>)>,
    manifest: &SyncManifest,
) -> Vec<FileChange> {
    let mut changes = Vec::new();
    let mut all_paths: std::collections::HashSet<&str> = std::collections::HashSet::new();

    for path in local_files.keys() {
        all_paths.insert(path.as_str());
    }
    for path in remote_files.keys() {
        all_paths.insert(path.as_str());
    }
    for path in manifest.files.keys() {
        all_paths.insert(path.as_str());
    }

    for path in all_paths {
        let local = local_files.get(path);
        let remote = remote_files.get(path);
        let synced = manifest.get_entry(path);

        let kind = match (local, remote, synced) {
            (Some(_), None, None) => FileChangeKind::LocalOnly,
            (None, Some(_), None) => FileChangeKind::RemoteOnly,
            (Some((lh, _)), Some((rh, _)), Some(entry)) => {
                let local_changed = lh != &entry.local_hash;
                let remote_changed = rh != &entry.remote_hash;
                match (local_changed, remote_changed) {
                    (true, true) => FileChangeKind::BothModified,
                    (true, false) => FileChangeKind::LocalModified,
                    (false, true) => FileChangeKind::RemoteModified,
                    (false, false) => FileChangeKind::Unchanged,
                }
            }
            (Some((_lh, _)), Some(_), None) => FileChangeKind::LocalOnly,
            (None, None, Some(_)) => continue,
            (Some(_), None, Some(_)) => FileChangeKind::LocalModified,
            (None, Some(_), Some(entry)) => {
                let remote_hash = &remote.unwrap().0;
                if remote_hash != &entry.remote_hash {
                    FileChangeKind::RemoteModified
                } else {
                    FileChangeKind::LocalDeleted
                }
            }
            (None, None, None) => continue,
        };

        if kind == FileChangeKind::Unchanged {
            continue;
        }

        changes.push(FileChange {
            path: path.to_string(),
            kind,
            local_hash: local.map(|(h, _)| h.clone()),
            remote_hash: remote.map(|(h, _)| h.clone()),
        });
    }

    changes.sort_by(|a, b| a.path.cmp(&b.path));
    changes
}

pub const EXCLUDED_PATTERNS: &[&str] = &[".lock", ".trash/", ".opennote/", ".tmp"];

pub fn should_sync_file(path: &str) -> bool {
    for pattern in EXCLUDED_PATTERNS {
        if path.contains(pattern) {
            return false;
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compute_hash_deterministic() {
        let h1 = compute_hash(b"hello world");
        let h2 = compute_hash(b"hello world");
        assert_eq!(h1, h2);
        assert!(h1.starts_with("sha256:"));
    }

    #[test]
    fn compute_hash_different_content() {
        let h1 = compute_hash(b"hello");
        let h2 = compute_hash(b"world");
        assert_ne!(h1, h2);
    }

    #[test]
    fn should_sync_normal_files() {
        assert!(should_sync_file("notebook/section/page.opn.json"));
        assert!(should_sync_file("notebook/notebook.json"));
        assert!(should_sync_file("notebook/section/assets/img.png"));
    }

    #[test]
    fn should_not_sync_excluded() {
        assert!(!should_sync_file(".lock"));
        assert!(!should_sync_file(".trash/item.json"));
        assert!(!should_sync_file(".opennote/index/something"));
        assert!(!should_sync_file("notebook/page.opn.json.tmp"));
    }

    #[test]
    fn detect_local_only() {
        let mut local = HashMap::new();
        local.insert("page.json".to_string(), ("hash1".to_string(), Utc::now()));
        let remote = HashMap::new();
        let manifest = SyncManifest::default();

        let changes = detect_changes(&local, &remote, &manifest);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].kind, FileChangeKind::LocalOnly);
    }

    #[test]
    fn detect_remote_only() {
        let local = HashMap::new();
        let mut remote = HashMap::new();
        remote.insert("page.json".to_string(), ("hash1".to_string(), Utc::now()));
        let manifest = SyncManifest::default();

        let changes = detect_changes(&local, &remote, &manifest);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].kind, FileChangeKind::RemoteOnly);
    }

    #[test]
    fn detect_unchanged() {
        let now = Utc::now();
        let mut local = HashMap::new();
        local.insert("page.json".to_string(), ("hash1".to_string(), now));
        let mut remote = HashMap::new();
        remote.insert("page.json".to_string(), ("hash1".to_string(), now));

        let mut manifest = SyncManifest::default();
        manifest.update_entry(
            "page.json",
            SyncFileEntry {
                local_hash: "hash1".to_string(),
                remote_hash: "hash1".to_string(),
                local_modified_at: now,
                remote_modified_at: now,
                synced_at: now,
            },
        );

        let changes = detect_changes(&local, &remote, &manifest);
        assert!(changes.is_empty());
    }

    #[test]
    fn detect_both_modified() {
        let now = Utc::now();
        let mut local = HashMap::new();
        local.insert("page.json".to_string(), ("hash_new_local".to_string(), now));
        let mut remote = HashMap::new();
        remote.insert(
            "page.json".to_string(),
            ("hash_new_remote".to_string(), now),
        );

        let mut manifest = SyncManifest::default();
        manifest.update_entry(
            "page.json",
            SyncFileEntry {
                local_hash: "hash_old".to_string(),
                remote_hash: "hash_old".to_string(),
                local_modified_at: now,
                remote_modified_at: now,
                synced_at: now,
            },
        );

        let changes = detect_changes(&local, &remote, &manifest);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].kind, FileChangeKind::BothModified);
    }

    #[test]
    fn detect_local_modified() {
        let now = Utc::now();
        let mut local = HashMap::new();
        local.insert("page.json".to_string(), ("hash_new".to_string(), now));
        let mut remote = HashMap::new();
        remote.insert("page.json".to_string(), ("hash_old".to_string(), now));

        let mut manifest = SyncManifest::default();
        manifest.update_entry(
            "page.json",
            SyncFileEntry {
                local_hash: "hash_old".to_string(),
                remote_hash: "hash_old".to_string(),
                local_modified_at: now,
                remote_modified_at: now,
                synced_at: now,
            },
        );

        let changes = detect_changes(&local, &remote, &manifest);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].kind, FileChangeKind::LocalModified);
    }

    #[test]
    fn manifest_save_and_load() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("sync_manifest.json");

        let mut manifest = SyncManifest::default();
        manifest.update_entry(
            "test.json",
            SyncFileEntry {
                local_hash: "abc".to_string(),
                remote_hash: "abc".to_string(),
                local_modified_at: Utc::now(),
                remote_modified_at: Utc::now(),
                synced_at: Utc::now(),
            },
        );

        manifest.save(&path).unwrap();
        let loaded = SyncManifest::load(&path).unwrap();
        assert_eq!(loaded.files.len(), 1);
        assert!(loaded.get_entry("test.json").is_some());
    }

    // ─── Phase 4 Retrofit: Additional Change Detection ───

    #[test]
    fn detect_remote_modified() {
        let now = Utc::now();
        let mut local = HashMap::new();
        local.insert("page.json".to_string(), ("hash_old".to_string(), now));
        let mut remote = HashMap::new();
        remote.insert(
            "page.json".to_string(),
            ("hash_new_remote".to_string(), now),
        );

        let mut manifest = SyncManifest::default();
        manifest.update_entry(
            "page.json",
            SyncFileEntry {
                local_hash: "hash_old".to_string(),
                remote_hash: "hash_old".to_string(),
                local_modified_at: now,
                remote_modified_at: now,
                synced_at: now,
            },
        );

        let changes = detect_changes(&local, &remote, &manifest);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].kind, FileChangeKind::RemoteModified);
    }

    #[test]
    fn detect_local_deleted() {
        let now = Utc::now();
        let local = HashMap::new();
        let mut remote = HashMap::new();
        remote.insert("page.json".to_string(), ("hash_old".to_string(), now));

        let mut manifest = SyncManifest::default();
        manifest.update_entry(
            "page.json",
            SyncFileEntry {
                local_hash: "hash_old".to_string(),
                remote_hash: "hash_old".to_string(),
                local_modified_at: now,
                remote_modified_at: now,
                synced_at: now,
            },
        );

        let changes = detect_changes(&local, &remote, &manifest);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].kind, FileChangeKind::LocalDeleted);
    }

    #[test]
    fn manifest_remove_entry() {
        let mut manifest = SyncManifest::default();
        manifest.update_entry(
            "file.json",
            SyncFileEntry {
                local_hash: "h1".to_string(),
                remote_hash: "h1".to_string(),
                local_modified_at: Utc::now(),
                remote_modified_at: Utc::now(),
                synced_at: Utc::now(),
            },
        );
        assert!(manifest.get_entry("file.json").is_some());

        manifest.remove_entry("file.json");
        assert!(manifest.get_entry("file.json").is_none());
    }

    #[test]
    fn manifest_load_nonexistent_returns_default() {
        let path = std::path::Path::new("/tmp/nonexistent_sync_manifest_xyz.json");
        let manifest = SyncManifest::load(path).unwrap();
        assert!(manifest.files.is_empty());
    }
}

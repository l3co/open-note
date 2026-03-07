use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::atomic::atomic_write_json;
use crate::error::{StorageError, StorageResult};

const LOCK_FILE_NAME: &str = ".lock";

#[derive(Debug, Serialize, Deserialize)]
pub struct LockFile {
    pub pid: u32,
    pub hostname: String,
    pub locked_at: String,
}

pub fn lock_path(workspace_root: &Path) -> PathBuf {
    workspace_root.join(LOCK_FILE_NAME)
}

pub fn acquire_lock(workspace_root: &Path) -> StorageResult<()> {
    let path = lock_path(workspace_root);

    if path.exists() {
        let content = fs::read_to_string(&path)?;
        if let Ok(lock) = serde_json::from_str::<LockFile>(&content) {
            if is_process_alive(lock.pid) {
                return Err(StorageError::WorkspaceLocked { pid: lock.pid });
            }
        }
        fs::remove_file(&path)?;
    }

    let lock = LockFile {
        pid: std::process::id(),
        hostname: hostname(),
        locked_at: Utc::now().to_rfc3339(),
    };

    atomic_write_json(&path, &lock)?;
    Ok(())
}

pub fn release_lock(workspace_root: &Path) -> StorageResult<()> {
    let path = lock_path(workspace_root);
    if path.exists() {
        fs::remove_file(&path)?;
    }
    Ok(())
}

fn is_process_alive(pid: u32) -> bool {
    #[cfg(unix)]
    {
        unsafe { libc::kill(pid as i32, 0) == 0 }
    }
    #[cfg(not(unix))]
    {
        let _ = pid;
        false
    }
}

fn hostname() -> String {
    std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "unknown".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn acquire_and_release_lock() {
        let dir = TempDir::new().unwrap();
        acquire_lock(dir.path()).unwrap();
        assert!(lock_path(dir.path()).exists());

        release_lock(dir.path()).unwrap();
        assert!(!lock_path(dir.path()).exists());
    }

    #[test]
    fn acquire_lock_fails_if_already_locked_by_self() {
        let dir = TempDir::new().unwrap();
        acquire_lock(dir.path()).unwrap();

        let result = acquire_lock(dir.path());
        assert!(result.is_err());

        release_lock(dir.path()).unwrap();
    }

    #[test]
    fn stale_lock_is_removed() {
        let dir = TempDir::new().unwrap();
        let lock = LockFile {
            pid: 999_999_999,
            hostname: "test".to_string(),
            locked_at: Utc::now().to_rfc3339(),
        };
        atomic_write_json(&lock_path(dir.path()), &lock).unwrap();

        acquire_lock(dir.path()).unwrap();
        assert!(lock_path(dir.path()).exists());

        release_lock(dir.path()).unwrap();
    }

    #[test]
    fn release_nonexistent_lock_is_ok() {
        let dir = TempDir::new().unwrap();
        release_lock(dir.path()).unwrap();
    }
}

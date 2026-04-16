use std::fs;
use std::io::Write;
use std::path::Path;

use crate::error::StorageResult;

pub fn atomic_write_json<T: serde::Serialize>(path: &Path, data: &T) -> StorageResult<()> {
    let json = serde_json::to_string_pretty(data)?;
    atomic_write_bytes(path, json.as_bytes())
}

pub fn atomic_write_bytes(path: &Path, data: &[u8]) -> StorageResult<()> {
    let tmp_path = path.with_extension("tmp");

    if let Some(parent) = path.parent() {
        create_dir_all_0755(parent)?;
    }

    // Open (or create/truncate) the tmp file.  The initial mode is determined
    // by the OS and the process umask.  We rely on the post-rename chmod below
    // to enforce 0o644 regardless of umask.
    let mut file = create_file(&tmp_path)?;
    file.write_all(data).map_err(|e| {
        std::io::Error::new(e.kind(), format!("write '{}': {e}", tmp_path.display()))
    })?;
    file.sync_all()?;

    fs::rename(&tmp_path, path).map_err(|e| {
        std::io::Error::new(
            e.kind(),
            format!(
                "rename '{}' -> '{}': {e}",
                tmp_path.display(),
                path.display()
            ),
        )
    })?;

    // chmod(2) ignores the process umask, so this always sets exactly 0o644
    // regardless of what umask was in effect when the file was created.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o644));
    }

    if let Some(parent) = path.parent() {
        if let Ok(dir) = fs::File::open(parent) {
            let _ = dir.sync_all();
        }
    }

    Ok(())
}

/// Creates `path` and all missing parent directories with mode 0o755 on Unix.
///
/// We cannot use `fs::create_dir_all` when the process umask is restrictive
/// (e.g. 0o177): it creates the first missing level with mode 0o600 (no execute
/// bit), then immediately fails trying to enter that directory to create the
/// next level.  Instead we create one level at a time and call `chmod(2)` —
/// which ignores umask — before descending into each newly created directory.
pub fn create_dir_all_0755(path: &Path) -> std::io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        // Walk from path upward to find the deepest ancestor that already
        // exists, collecting the levels we need to create along the way.
        let mut to_create: Vec<std::path::PathBuf> = Vec::new();
        let mut p = path.to_path_buf();
        loop {
            if p.exists() {
                // Ensure even pre-existing dirs have 0o755 (e.g. the workspace
                // root created by create_workspace with bare create_dir_all).
                let _ = fs::set_permissions(&p, fs::Permissions::from_mode(0o755));
                break;
            }
            to_create.push(p.clone());
            match p.parent() {
                Some(parent) if parent != p.as_path() => p = parent.to_path_buf(),
                _ => break,
            }
        }
        // to_create is leaf-to-root; reverse to create top-down.
        to_create.reverse();

        for dir in &to_create {
            // Another thread may have created it between our check and here.
            if let Err(e) = fs::create_dir(dir) {
                if e.kind() != std::io::ErrorKind::AlreadyExists {
                    return Err(e);
                }
            }
            // chmod immediately so the next level can be entered.
            let _ = fs::set_permissions(dir, fs::Permissions::from_mode(0o755));
        }

        Ok(())
    }
    #[cfg(not(unix))]
    {
        fs::create_dir_all(path)
    }
}

/// Creates or truncates a file.  On Unix, if the file already exists with
/// restricted permissions (e.g. mode 0o400 left by a crashed previous run),
/// we attempt a preemptive chmod so the open succeeds.
fn create_file(path: &Path) -> std::io::Result<fs::File> {
    #[cfg(unix)]
    {
        // If a stale .tmp exists with too-restrictive permissions, chmod it
        // first; otherwise O_WRONLY|O_TRUNC would fail with EACCES.
        if path.exists() {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o644));
        }
    }
    fs::File::create(path)
        .map_err(|e| std::io::Error::new(e.kind(), format!("create '{}': {e}", path.display())))
}

pub fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> StorageResult<T> {
    let content = fs::read_to_string(path)?;
    let data = serde_json::from_str(&content)?;
    Ok(data)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};
    use tempfile::TempDir;

    #[derive(Debug, Serialize, Deserialize, PartialEq)]
    struct TestData {
        name: String,
        value: u32,
    }

    #[test]
    fn atomic_write_and_read_json() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("test.json");

        let data = TestData {
            name: "hello".to_string(),
            value: 42,
        };

        atomic_write_json(&path, &data).unwrap();
        let read_back: TestData = read_json(&path).unwrap();
        assert_eq!(data, read_back);
    }

    #[test]
    fn atomic_write_creates_parent_dirs() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("sub").join("dir").join("test.json");

        let data = TestData {
            name: "nested".to_string(),
            value: 1,
        };

        atomic_write_json(&path, &data).unwrap();
        assert!(path.exists());
    }

    #[test]
    fn no_tmp_file_left_after_write() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("test.json");
        let tmp_path = path.with_extension("tmp");

        atomic_write_json(&path, &"hello").unwrap();
        assert!(!tmp_path.exists());
        assert!(path.exists());
    }

    #[test]
    fn atomic_write_sets_readable_permissions() {
        use std::os::unix::fs::PermissionsExt;
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("test.json");
        atomic_write_json(&path, &"hello").unwrap();
        let mode = std::fs::metadata(&path).unwrap().permissions().mode();
        assert!(
            mode & 0o600 == 0o600,
            "file must be owner-readable and writable, got mode {mode:o}"
        );
    }

    /// Verifies that even with a very restrictive umask the final file ends up
    /// with at least 0o600 (owner rw).  umask(2) is process-wide; we serialise
    /// this test with a mutex so it does not race with the other tests.
    #[cfg(unix)]
    #[test]
    fn atomic_write_ignores_restrictive_umask() {
        use std::os::unix::fs::PermissionsExt;

        // umask is process-wide.  Serialize this test with all others that either
        // set the umask or create directories, to avoid races.
        static LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
        let _guard = LOCK.lock().unwrap();

        let dir = TempDir::new().unwrap();
        let path = dir.path().join("umask_test.json");

        let old_umask = unsafe { libc::umask(0o177) };
        atomic_write_json(&path, &"hello").unwrap();
        unsafe { libc::umask(old_umask) };

        let mode = std::fs::metadata(&path).unwrap().permissions().mode();
        assert!(
            mode & 0o600 == 0o600,
            "file must be rw despite restrictive umask, got mode {mode:o}"
        );
    }
}

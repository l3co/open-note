use std::fs;
use std::io::Write;
use std::path::Path;

#[cfg(unix)]
extern crate libc;

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

    // Create the tmp file with mode 0o644, bypassing the process umask entirely.
    // Using fs::File::create() would apply the umask (e.g. umask 0o177 → 0o400),
    // leaving the file read-only and causing EACCES on the next open.
    let mut file = open_file_0644(&tmp_path)?;
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

    // Belt-and-suspenders: explicitly set permissions after rename.
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

/// Creates `path` and all parent directories with mode 0o755 on Unix,
/// bypassing the process umask.
///
/// Both `mkdir(2)` and `DirBuilder::mode()` apply the umask to the requested
/// mode, so a restrictive umask (e.g. 0o177) produces directories without the
/// execute bit, making them untraversable.  The only reliable way to bypass
/// this is to zero the umask for the duration of the call and restore it
/// immediately afterwards.  The window is a few microseconds; in the worst
/// case another thread creates a file that ends up world-readable (0o666 →
/// acceptable for a local desktop app).
pub fn create_dir_all_0755(path: &Path) -> std::io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        let old = unsafe { libc::umask(0) };
        let result = fs::DirBuilder::new()
            .recursive(true)
            .mode(0o755)
            .create(path);
        unsafe { libc::umask(old) };
        result
    }
    #[cfg(not(unix))]
    {
        fs::create_dir_all(path)
    }
}

/// Opens (or creates/truncates) a file with mode 0o644 on Unix, bypassing umask.
///
/// `open(2)` also applies the umask to the requested mode, so we zero the
/// umask for the duration of the call (same rationale as `create_dir_all_0755`).
fn open_file_0644(path: &Path) -> std::io::Result<fs::File> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        let old = unsafe { libc::umask(0) };
        let result = fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o644)
            .open(path)
            .map_err(|e| {
                std::io::Error::new(e.kind(), format!("create '{}': {e}", path.display()))
            });
        unsafe { libc::umask(old) };
        result
    }
    #[cfg(not(unix))]
    {
        fs::File::create(path)
            .map_err(|e| std::io::Error::new(e.kind(), format!("create '{}': {e}", path.display())))
    }
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
        // File must be owner-readable (0o400) and writable (0o200)
        assert!(
            mode & 0o600 == 0o600,
            "file must be owner-readable and writable, got mode {mode:o}"
        );
    }

    #[cfg(unix)]
    #[test]
    fn atomic_write_ignores_restrictive_umask() {
        use std::os::unix::fs::PermissionsExt;
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("umask_test.json");

        // Temporarily set a very restrictive umask (0o177 → new files would be 0o400)
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

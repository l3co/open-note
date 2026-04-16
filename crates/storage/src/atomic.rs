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
        fs::create_dir_all(parent)?;
    }

    let mut file = fs::File::create(&tmp_path)?;
    file.write_all(data)?;
    file.sync_all()?;

    fs::rename(&tmp_path, path)?;

    if let Some(parent) = path.parent() {
        if let Ok(dir) = fs::File::open(parent) {
            let _ = dir.sync_all();
        }
    }

    Ok(())
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
        // Verifica que owner pode ler (0o400) e escrever (0o200)
        assert!(
            mode & 0o600 == 0o600,
            "file must be owner-readable and writable, got mode {mode:o}"
        );
    }
}

use std::path::PathBuf;

use crate::error::{SyncError, SyncResult};
use crate::types::AuthToken;

const APP_NAME: &str = "open-note";

fn entry_name(provider: &str) -> String {
    format!("sync-{provider}")
}

/// Diretório raiz da app: ~/.opennote/
pub fn opennote_dir() -> PathBuf {
    let home = std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));
    home.join(".opennote")
}

/// Diretório de workspaces baixados da nuvem: ~/.opennote/workspaces/
pub fn workspaces_dir() -> PathBuf {
    opennote_dir().join("workspaces")
}

/// Diretório de tokens em filesystem: ~/.opennote/tokens/
fn tokens_dir() -> PathBuf {
    opennote_dir().join("tokens")
}

fn token_file(provider: &str) -> PathBuf {
    tokens_dir().join(format!("{provider}.token"))
}

/// Persiste o token OAuth2.
/// Primário: filesystem (~/.opennote/tokens/).
/// Secundário best-effort: keychain do SO.
pub fn store_token(provider: &str, token: &AuthToken) -> SyncResult<()> {
    let json = serde_json::to_string(token)?;

    // Filesystem (primário — sempre funciona, sem diálogos de permissão)
    let dir = tokens_dir();
    std::fs::create_dir_all(&dir).map_err(|e| SyncError::AuthFailed {
        message: format!("Cannot create tokens dir: {e}"),
    })?;
    std::fs::write(token_file(provider), json.as_bytes()).map_err(|e| SyncError::AuthFailed {
        message: format!("Cannot write token file: {e}"),
    })?;

    // Keychain (best-effort — sem falha se não disponível)
    if let Ok(entry) = keyring::Entry::new(APP_NAME, &entry_name(provider)) {
        let _ = entry.set_password(&serde_json::to_string(token).unwrap_or_default());
    }

    Ok(())
}

/// Recupera o token OAuth2. Tenta filesystem primeiro, depois keychain.
pub fn get_token(provider: &str) -> SyncResult<Option<AuthToken>> {
    // Filesystem (primário)
    let path = token_file(provider);
    if path.exists() {
        match std::fs::read_to_string(&path) {
            Ok(json) => match serde_json::from_str::<AuthToken>(&json) {
                Ok(token) => return Ok(Some(token)),
                Err(e) => {
                    // Arquivo corrompido — remove e tenta keychain
                    let _ = std::fs::remove_file(&path);
                    eprintln!("[token_store] corrupted token file for {provider}: {e}");
                }
            },
            Err(e) => eprintln!("[token_store] read error for {provider}: {e}"),
        }
    }

    // Keychain (fallback)
    match keyring::Entry::new(APP_NAME, &entry_name(provider)) {
        Ok(entry) => match entry.get_password() {
            Ok(json) => {
                let token: AuthToken = serde_json::from_str(&json)?;
                // Migra para filesystem para próximas leituras
                let _ = store_token(provider, &token);
                Ok(Some(token))
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Ok(None),
        },
        Err(_) => Ok(None),
    }
}

/// Remove o token OAuth2 de filesystem e keychain.
pub fn delete_token(provider: &str) -> SyncResult<()> {
    // Filesystem
    let path = token_file(provider);
    if path.exists() {
        let _ = std::fs::remove_file(&path);
    }

    // Keychain (best-effort)
    if let Ok(entry) = keyring::Entry::new(APP_NAME, &entry_name(provider)) {
        match entry.delete_credential() {
            Ok(_) | Err(keyring::Error::NoEntry) => {}
            Err(_) => {}
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::AuthToken;
    use std::sync::Mutex;
    use tempfile::TempDir;

    static HOME_LOCK: Mutex<()> = Mutex::new(());

    fn dummy_token() -> AuthToken {
        AuthToken {
            access_token: "access_abc".to_string(),
            refresh_token: Some("refresh_xyz".to_string()),
            expires_at: None,
            token_type: "Bearer".to_string(),
        }
    }

    fn with_temp_home<F: FnOnce(&TempDir)>(f: F) {
        let _guard = HOME_LOCK.lock().unwrap();
        let dir = TempDir::new().unwrap();
        let old_home = std::env::var("HOME").ok();
        std::env::set_var("HOME", dir.path());
        f(&dir);
        match old_home {
            Some(h) => std::env::set_var("HOME", h),
            None => std::env::remove_var("HOME"),
        }
    }

    #[test]
    fn opennote_dir_contains_opennote_segment() {
        let dir = opennote_dir();
        assert!(dir.to_str().unwrap().contains(".opennote"));
    }

    #[test]
    fn workspaces_dir_is_child_of_opennote_dir() {
        let ws = workspaces_dir();
        let on = opennote_dir();
        assert!(ws.starts_with(on));
        assert!(ws.to_str().unwrap().contains("workspaces"));
    }

    #[test]
    fn store_and_get_token_roundtrip() {
        with_temp_home(|_dir| {
            let token = dummy_token();
            store_token("google_drive", &token).unwrap();

            let retrieved = get_token("google_drive").unwrap();
            assert!(retrieved.is_some());
            let t = retrieved.unwrap();
            assert_eq!(t.access_token, "access_abc");
            assert_eq!(t.refresh_token, Some("refresh_xyz".to_string()));
        });
    }

    #[test]
    fn get_token_returns_none_when_not_stored() {
        with_temp_home(|_dir| {
            let result = get_token("nonexistent_provider").unwrap();
            assert!(result.is_none());
        });
    }

    #[test]
    fn delete_token_removes_file() {
        with_temp_home(|_dir| {
            store_token("dropbox", &dummy_token()).unwrap();
            assert!(get_token("dropbox").unwrap().is_some());

            delete_token("dropbox").unwrap();
            assert!(get_token("dropbox").unwrap().is_none());
        });
    }

    #[test]
    fn delete_token_nonexistent_does_not_error() {
        with_temp_home(|_dir| {
            let result = delete_token("never_stored");
            assert!(result.is_ok());
        });
    }

    #[test]
    fn get_token_corrupted_file_returns_none_and_removes_file() {
        with_temp_home(|_dir| {
            let dir = tokens_dir();
            std::fs::create_dir_all(&dir).unwrap();
            let path = dir.join("test_provider.token");
            std::fs::write(&path, b"{invalid json!!!}").unwrap();
            assert!(path.exists());

            let result = get_token("test_provider").unwrap();
            assert!(result.is_none());
            assert!(!path.exists());
        });
    }

    #[test]
    fn store_token_creates_tokens_directory() {
        with_temp_home(|dir| {
            let expected_dir = dir.path().join(".opennote").join("tokens");
            assert!(!expected_dir.exists());

            store_token("onedrive", &dummy_token()).unwrap();

            assert!(expected_dir.exists());
            assert!(expected_dir.join("onedrive.token").exists());
        });
    }
}

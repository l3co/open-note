use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncProviderType {
    GoogleDrive,
    OneDrive,
    Dropbox,
}

impl std::fmt::Display for SyncProviderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::GoogleDrive => write!(f, "Google Drive"),
            Self::OneDrive => write!(f, "OneDrive"),
            Self::Dropbox => write!(f, "Dropbox"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub token_type: String,
}

impl AuthToken {
    pub fn is_expired(&self) -> bool {
        match self.expires_at {
            Some(exp) => Utc::now() >= exp,
            None => false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteFile {
    pub path: String,
    pub hash: String,
    pub size: u64,
    pub modified_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    pub name: String,
    pub display_name: String,
    pub connected: bool,
    pub user_email: Option<String>,
    pub last_synced_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SyncStatus {
    pub is_syncing: bool,
    pub provider: Option<String>,
    pub progress: Option<SyncProgress>,
    pub last_synced_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
    pub pending_conflicts: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncProgress {
    pub phase: SyncPhase,
    pub current: u32,
    pub total: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncPhase {
    Comparing,
    Uploading,
    Downloading,
    Finalizing,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPreferences {
    pub enabled: bool,
    pub provider: Option<SyncProviderType>,
    pub interval_seconds: u64,
    pub synced_notebook_ids: Vec<String>,
}

impl Default for SyncPreferences {
    fn default() -> Self {
        Self {
            enabled: false,
            provider: None,
            interval_seconds: 300,
            synced_notebook_ids: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConflict {
    pub id: String,
    pub page_title: String,
    pub local_modified_at: DateTime<Utc>,
    pub remote_modified_at: DateTime<Utc>,
    pub local_path: String,
    pub conflict_path: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConflictResolution {
    KeepLocal,
    KeepRemote,
    KeepBoth,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FileChangeKind {
    LocalOnly,
    RemoteOnly,
    LocalModified,
    RemoteModified,
    BothModified,
    LocalDeleted,
    RemoteDeleted,
    Unchanged,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChange {
    pub path: String,
    pub kind: FileChangeKind,
    pub local_hash: Option<String>,
    pub remote_hash: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auth_token_not_expired_when_no_expiry() {
        let token = AuthToken {
            access_token: "abc".to_string(),
            refresh_token: None,
            expires_at: None,
            token_type: "Bearer".to_string(),
        };
        assert!(!token.is_expired());
    }

    #[test]
    fn auth_token_expired_when_past() {
        let token = AuthToken {
            access_token: "abc".to_string(),
            refresh_token: None,
            expires_at: Some(Utc::now() - chrono::Duration::hours(1)),
            token_type: "Bearer".to_string(),
        };
        assert!(token.is_expired());
    }

    #[test]
    fn auth_token_not_expired_when_future() {
        let token = AuthToken {
            access_token: "abc".to_string(),
            refresh_token: None,
            expires_at: Some(Utc::now() + chrono::Duration::hours(1)),
            token_type: "Bearer".to_string(),
        };
        assert!(!token.is_expired());
    }

    #[test]
    fn default_sync_preferences() {
        let prefs = SyncPreferences::default();
        assert!(!prefs.enabled);
        assert!(prefs.provider.is_none());
        assert_eq!(prefs.interval_seconds, 300);
        assert!(prefs.synced_notebook_ids.is_empty());
    }

    #[test]
    fn provider_type_display() {
        assert_eq!(SyncProviderType::GoogleDrive.to_string(), "Google Drive");
        assert_eq!(SyncProviderType::OneDrive.to_string(), "OneDrive");
        assert_eq!(SyncProviderType::Dropbox.to_string(), "Dropbox");
    }

    #[test]
    fn provider_type_serialization() {
        let json = serde_json::to_string(&SyncProviderType::GoogleDrive).unwrap();
        assert_eq!(json, "\"google_drive\"");
        let parsed: SyncProviderType = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, SyncProviderType::GoogleDrive);
    }
}

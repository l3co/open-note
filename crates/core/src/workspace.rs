use std::path::PathBuf;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::error::CoreError;
use crate::id::{NotebookId, PageId, SectionId, WorkspaceId};

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct Workspace {
    pub id: WorkspaceId,
    pub name: String,
    #[ts(type = "string")]
    pub root_path: PathBuf,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub settings: WorkspaceSettings,
}

impl Workspace {
    pub fn new(name: &str, root_path: PathBuf) -> Result<Self, CoreError> {
        let name = name.trim().to_string();
        if name.is_empty() {
            return Err(CoreError::Validation {
                message: "Workspace name cannot be empty".to_string(),
            });
        }

        let now = Utc::now();
        Ok(Self {
            id: WorkspaceId::new(),
            name,
            root_path,
            created_at: now,
            updated_at: now,
            settings: WorkspaceSettings::default(),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct WorkspaceSettings {
    pub default_notebook_id: Option<NotebookId>,
    pub auto_save_interval_ms: u64,
    pub sidebar_width: u32,
    pub sidebar_open: bool,
    pub last_opened_page_id: Option<PageId>,
    #[serde(default)]
    pub quick_notes_notebook_id: Option<NotebookId>,
    #[serde(default)]
    pub quick_notes_section_id: Option<SectionId>,
}

impl Default for WorkspaceSettings {
    fn default() -> Self {
        Self {
            default_notebook_id: None,
            auto_save_interval_ms: 1000,
            sidebar_width: 260,
            sidebar_open: true,
            last_opened_page_id: None,
            quick_notes_notebook_id: None,
            quick_notes_section_id: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_workspace_with_valid_name() {
        let ws = Workspace::new("Meus Estudos", "/tmp/estudos".into()).unwrap();
        assert_eq!(ws.name, "Meus Estudos");
        assert!(!ws.id.is_nil());
    }

    #[test]
    fn reject_empty_workspace_name() {
        let result = Workspace::new("", "/tmp/empty".into());
        assert!(result.is_err());
    }

    #[test]
    fn reject_whitespace_only_name() {
        let result = Workspace::new("   ", "/tmp/ws".into());
        assert!(result.is_err());
    }

    #[test]
    fn trims_workspace_name() {
        let ws = Workspace::new("  My Notes  ", "/tmp/notes".into()).unwrap();
        assert_eq!(ws.name, "My Notes");
    }

    #[test]
    fn default_settings_are_sensible() {
        let settings = WorkspaceSettings::default();
        assert_eq!(settings.auto_save_interval_ms, 1000);
        assert_eq!(settings.sidebar_width, 260);
        assert!(settings.sidebar_open);
        assert!(settings.default_notebook_id.is_none());
    }
}

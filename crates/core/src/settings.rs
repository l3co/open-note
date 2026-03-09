use std::path::PathBuf;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::error::CoreError;
use crate::id::WorkspaceId;

pub const MAX_ACTIVE_WORKSPACES: usize = 10;
pub const CURRENT_APP_STATE_VERSION: u32 = 2;

fn default_schema_version() -> u32 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct ActiveWorkspace {
    pub id: WorkspaceId,
    #[ts(type = "string")]
    pub path: PathBuf,
    pub name: String,
    pub opened_at: DateTime<Utc>,
}

impl ActiveWorkspace {
    pub fn new(id: WorkspaceId, path: PathBuf, name: String) -> Self {
        Self {
            id,
            path,
            name,
            opened_at: Utc::now(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct AppState {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    pub recent_workspaces: Vec<RecentWorkspace>,
    #[serde(default)]
    pub active_workspaces: Vec<ActiveWorkspace>,
    #[serde(default)]
    pub focused_workspace_id: Option<WorkspaceId>,
    pub last_opened_workspace: Option<PathBuf>,
    pub global_settings: GlobalSettings,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            schema_version: CURRENT_APP_STATE_VERSION,
            recent_workspaces: Vec::new(),
            active_workspaces: Vec::new(),
            focused_workspace_id: None,
            last_opened_workspace: None,
            global_settings: GlobalSettings::default(),
        }
    }
}

impl AppState {
    pub fn add_recent_workspace(&mut self, path: PathBuf, name: String) {
        let now = Utc::now();

        self.recent_workspaces.retain(|rw| rw.path != path);

        self.recent_workspaces.insert(
            0,
            RecentWorkspace {
                path: path.clone(),
                name,
                last_opened_at: now,
            },
        );

        const MAX_RECENT: usize = 10;
        self.recent_workspaces.truncate(MAX_RECENT);
        self.last_opened_workspace = Some(path);
    }

    pub fn remove_recent_workspace(&mut self, path: &PathBuf) {
        self.recent_workspaces.retain(|rw| &rw.path != path);
        if self.last_opened_workspace.as_ref() == Some(path) {
            self.last_opened_workspace = self.recent_workspaces.first().map(|rw| rw.path.clone());
        }
    }

    /// Adiciona workspace à lista de ativos (max `MAX_ACTIVE_WORKSPACES`).
    /// Se o ID já existir, move para o início sem duplicar.
    /// Remove o mais antigo se o limite for atingido.
    pub fn activate_workspace(&mut self, id: WorkspaceId, path: PathBuf, name: String) {
        self.active_workspaces.retain(|aw| aw.id != id);

        if self.active_workspaces.len() >= MAX_ACTIVE_WORKSPACES {
            self.active_workspaces.pop();
        }

        self.active_workspaces
            .insert(0, ActiveWorkspace::new(id, path.clone(), name.clone()));

        self.focused_workspace_id = Some(id);
        self.last_opened_workspace = Some(path);
    }

    /// Remove workspace da lista de ativos.
    /// Se era o focused, move o foco para o próximo disponível.
    pub fn deactivate_workspace(&mut self, id: &WorkspaceId) {
        self.active_workspaces.retain(|aw| &aw.id != id);

        if self.focused_workspace_id.as_ref() == Some(id) {
            self.focused_workspace_id = self.active_workspaces.first().map(|aw| aw.id);
            self.last_opened_workspace = self.active_workspaces.first().map(|aw| aw.path.clone());
        }
    }

    /// Define qual workspace está em foco.
    /// Retorna erro se o ID não estiver na lista de ativos.
    pub fn focus_workspace(&mut self, id: &WorkspaceId) -> Result<(), CoreError> {
        if !self.active_workspaces.iter().any(|aw| &aw.id == id) {
            return Err(CoreError::NotFound {
                entity: "ActiveWorkspace".to_string(),
                id: id.to_string(),
            });
        }
        self.focused_workspace_id = Some(*id);
        if let Some(aw) = self.active_workspaces.iter().find(|aw| &aw.id == id) {
            self.last_opened_workspace = Some(aw.path.clone());
        }
        Ok(())
    }

    /// Retorna workspace ativo em foco.
    pub fn focused_workspace(&self) -> Option<&ActiveWorkspace> {
        let id = self.focused_workspace_id.as_ref()?;
        self.active_workspaces.iter().find(|aw| &aw.id == id)
    }

    /// Lista todos os workspaces ativos.
    pub fn list_active_workspaces(&self) -> &[ActiveWorkspace] {
        &self.active_workspaces
    }

    /// Sincroniza campos legados com os novos para backward compatibility.
    /// Chamado após deserialização de JSON existente sem `active_workspaces`.
    pub fn sync_legacy_fields(&mut self) {
        if let Some(focused) = self.focused_workspace() {
            self.last_opened_workspace = Some(focused.path.clone());
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct RecentWorkspace {
    pub path: PathBuf,
    pub name: String,
    pub last_opened_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct GlobalSettings {
    pub theme: ThemeConfig,
    pub language: Language,
    pub window_bounds: Option<WindowBounds>,
}

impl Default for GlobalSettings {
    fn default() -> Self {
        Self {
            theme: ThemeConfig::default(),
            language: Language::En,
            window_bounds: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct ThemeConfig {
    pub base_theme: BaseTheme,
    pub accent_color: String,
    pub chrome_tint: ChromeTint,
}

impl Default for ThemeConfig {
    fn default() -> Self {
        Self {
            base_theme: BaseTheme::System,
            accent_color: "Blue".to_string(),
            chrome_tint: ChromeTint::Neutral,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
#[serde(rename_all = "snake_case")]
pub enum BaseTheme {
    Light,
    Dark,
    Paper,
    System,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
#[serde(rename_all = "snake_case")]
pub enum ChromeTint {
    Neutral,
    Tinted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
#[serde(rename_all = "snake_case")]
pub enum Language {
    PtBr,
    En,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct WindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_app_state_has_no_workspaces() {
        let state = AppState::default();
        assert!(state.recent_workspaces.is_empty());
        assert!(state.last_opened_workspace.is_none());
        assert!(state.active_workspaces.is_empty());
        assert!(state.focused_workspace_id.is_none());
    }

    #[test]
    fn add_recent_workspace_inserts_at_front() {
        let mut state = AppState::default();
        state.add_recent_workspace("/tmp/ws1".into(), "WS 1".to_string());
        state.add_recent_workspace("/tmp/ws2".into(), "WS 2".to_string());

        assert_eq!(state.recent_workspaces.len(), 2);
        assert_eq!(state.recent_workspaces[0].name, "WS 2");
        assert_eq!(state.recent_workspaces[1].name, "WS 1");
    }

    #[test]
    fn add_duplicate_workspace_moves_to_front() {
        let mut state = AppState::default();
        state.add_recent_workspace("/tmp/ws1".into(), "WS 1".to_string());
        state.add_recent_workspace("/tmp/ws2".into(), "WS 2".to_string());
        state.add_recent_workspace("/tmp/ws1".into(), "WS 1".to_string());

        assert_eq!(state.recent_workspaces.len(), 2);
        assert_eq!(state.recent_workspaces[0].name, "WS 1");
    }

    #[test]
    fn max_10_recent_workspaces() {
        let mut state = AppState::default();
        for i in 0..15 {
            state.add_recent_workspace(format!("/tmp/ws{i}").into(), format!("WS {i}"));
        }
        assert_eq!(state.recent_workspaces.len(), 10);
        assert_eq!(state.recent_workspaces[0].name, "WS 14");
    }

    #[test]
    fn remove_recent_workspace_updates_last_opened() {
        let mut state = AppState::default();
        state.add_recent_workspace("/tmp/ws1".into(), "WS 1".to_string());
        state.add_recent_workspace("/tmp/ws2".into(), "WS 2".to_string());
        state.remove_recent_workspace(&"/tmp/ws2".into());

        assert_eq!(state.recent_workspaces.len(), 1);
        assert_eq!(state.last_opened_workspace, Some(PathBuf::from("/tmp/ws1")));
    }

    #[test]
    fn default_theme_is_system_blue_neutral() {
        let theme = ThemeConfig::default();
        assert_eq!(theme.base_theme, BaseTheme::System);
        assert_eq!(theme.accent_color, "Blue");
        assert_eq!(theme.chrome_tint, ChromeTint::Neutral);
    }

    // ── Multi-workspace tests ──────────────────────────────────────────────

    #[test]
    fn activate_single_workspace() {
        let mut state = AppState::default();
        let id = WorkspaceId::new();
        state.activate_workspace(id, "/tmp/ws1".into(), "WS 1".to_string());

        assert_eq!(state.active_workspaces.len(), 1);
        assert_eq!(state.focused_workspace_id, Some(id));
        assert_eq!(state.last_opened_workspace, Some(PathBuf::from("/tmp/ws1")));
        assert_eq!(state.focused_workspace().unwrap().name, "WS 1");
    }

    #[test]
    fn activate_multiple_workspaces() {
        let mut state = AppState::default();
        let id_a = WorkspaceId::new();
        let id_b = WorkspaceId::new();
        let id_c = WorkspaceId::new();
        state.activate_workspace(id_a, "/tmp/ws_a".into(), "WS A".to_string());
        state.activate_workspace(id_b, "/tmp/ws_b".into(), "WS B".to_string());
        state.activate_workspace(id_c, "/tmp/ws_c".into(), "WS C".to_string());

        assert_eq!(state.active_workspaces.len(), 3);
        assert_eq!(state.focused_workspace_id, Some(id_c));
        assert_eq!(state.active_workspaces[0].id, id_c);
        assert_eq!(state.active_workspaces[1].id, id_b);
        assert_eq!(state.active_workspaces[2].id, id_a);
    }

    #[test]
    fn activate_duplicate_moves_to_front() {
        let mut state = AppState::default();
        let id_a = WorkspaceId::new();
        let id_b = WorkspaceId::new();
        state.activate_workspace(id_a, "/tmp/ws_a".into(), "WS A".to_string());
        state.activate_workspace(id_b, "/tmp/ws_b".into(), "WS B".to_string());
        state.activate_workspace(id_a, "/tmp/ws_a".into(), "WS A".to_string());

        assert_eq!(state.active_workspaces.len(), 2);
        assert_eq!(state.active_workspaces[0].id, id_a);
        assert_eq!(state.focused_workspace_id, Some(id_a));
    }

    #[test]
    fn deactivate_workspace_updates_focus() {
        let mut state = AppState::default();
        let id_a = WorkspaceId::new();
        let id_b = WorkspaceId::new();
        state.activate_workspace(id_a, "/tmp/ws_a".into(), "WS A".to_string());
        state.activate_workspace(id_b, "/tmp/ws_b".into(), "WS B".to_string());

        state.deactivate_workspace(&id_b);

        assert_eq!(state.active_workspaces.len(), 1);
        assert_eq!(state.focused_workspace_id, Some(id_a));
        assert_eq!(
            state.last_opened_workspace,
            Some(PathBuf::from("/tmp/ws_a"))
        );
    }

    #[test]
    fn deactivate_non_focused_keeps_focus() {
        let mut state = AppState::default();
        let id_a = WorkspaceId::new();
        let id_b = WorkspaceId::new();
        state.activate_workspace(id_a, "/tmp/ws_a".into(), "WS A".to_string());
        state.activate_workspace(id_b, "/tmp/ws_b".into(), "WS B".to_string());

        state.deactivate_workspace(&id_a);

        assert_eq!(state.active_workspaces.len(), 1);
        assert_eq!(state.focused_workspace_id, Some(id_b));
    }

    #[test]
    fn deactivate_last_workspace_clears_focus() {
        let mut state = AppState::default();
        let id = WorkspaceId::new();
        state.activate_workspace(id, "/tmp/ws".into(), "WS".to_string());
        state.deactivate_workspace(&id);

        assert!(state.active_workspaces.is_empty());
        assert!(state.focused_workspace_id.is_none());
        assert!(state.last_opened_workspace.is_none());
    }

    #[test]
    fn max_active_workspaces_enforced() {
        let mut state = AppState::default();
        let mut ids: Vec<WorkspaceId> = Vec::new();
        for i in 0..MAX_ACTIVE_WORKSPACES {
            let id = WorkspaceId::new();
            ids.push(id);
            state.activate_workspace(id, format!("/tmp/ws_{i}").into(), format!("WS {i}"));
        }
        assert_eq!(state.active_workspaces.len(), MAX_ACTIVE_WORKSPACES);

        let extra_id = WorkspaceId::new();
        state.activate_workspace(extra_id, "/tmp/ws_extra".into(), "WS Extra".to_string());

        assert_eq!(state.active_workspaces.len(), MAX_ACTIVE_WORKSPACES);
        assert_eq!(state.active_workspaces[0].id, extra_id);
        let has_oldest = state.active_workspaces.iter().any(|aw| aw.id == ids[0]);
        assert!(!has_oldest, "oldest workspace should have been evicted");
    }

    #[test]
    fn focus_nonexistent_workspace_errors() {
        let mut state = AppState::default();
        let phantom_id = WorkspaceId::new();
        let result = state.focus_workspace(&phantom_id);
        assert!(result.is_err());
    }

    #[test]
    fn focus_workspace_switches_correctly() {
        let mut state = AppState::default();
        let id_a = WorkspaceId::new();
        let id_b = WorkspaceId::new();
        state.activate_workspace(id_a, "/tmp/ws_a".into(), "WS A".to_string());
        state.activate_workspace(id_b, "/tmp/ws_b".into(), "WS B".to_string());

        state.focus_workspace(&id_a).unwrap();

        assert_eq!(state.focused_workspace_id, Some(id_a));
        assert_eq!(state.focused_workspace().unwrap().name, "WS A");
        assert_eq!(
            state.last_opened_workspace,
            Some(PathBuf::from("/tmp/ws_a"))
        );
    }

    #[test]
    fn list_active_workspaces_returns_all() {
        let mut state = AppState::default();
        let id_a = WorkspaceId::new();
        let id_b = WorkspaceId::new();
        state.activate_workspace(id_a, "/tmp/ws_a".into(), "WS A".to_string());
        state.activate_workspace(id_b, "/tmp/ws_b".into(), "WS B".to_string());

        let list = state.list_active_workspaces();
        assert_eq!(list.len(), 2);
    }

    #[test]
    fn sync_legacy_fields_updates_last_opened() {
        let mut state = AppState::default();
        let id = WorkspaceId::new();
        state.activate_workspace(id, "/tmp/ws".into(), "WS".to_string());
        state.last_opened_workspace = None;

        state.sync_legacy_fields();

        assert_eq!(state.last_opened_workspace, Some(PathBuf::from("/tmp/ws")));
    }

    #[test]
    fn serialization_roundtrip() {
        let mut state = AppState::default();
        let id = WorkspaceId::new();
        state.activate_workspace(id, "/tmp/ws".into(), "WS".to_string());
        state.add_recent_workspace("/tmp/ws".into(), "WS".to_string());

        let json = serde_json::to_string(&state).expect("should serialize");
        let restored: AppState = serde_json::from_str(&json).expect("should deserialize");

        assert_eq!(restored.active_workspaces.len(), 1);
        assert_eq!(restored.focused_workspace_id, Some(id));
        assert_eq!(restored.active_workspaces[0].name, "WS");
    }

    #[test]
    fn backward_compat_old_json_without_active_workspaces() {
        let old_json = r#"{
            "recent_workspaces": [
                {"path": "/tmp/old", "name": "Old WS", "last_opened_at": "2024-01-01T00:00:00Z"}
            ],
            "last_opened_workspace": "/tmp/old",
            "global_settings": {
                "theme": {
                    "base_theme": "system",
                    "accent_color": "Blue",
                    "chrome_tint": "neutral"
                },
                "language": "en",
                "window_bounds": null
            }
        }"#;

        let state: AppState = serde_json::from_str(old_json).expect("old JSON should deserialize");

        assert_eq!(state.active_workspaces.len(), 0);
        assert!(state.focused_workspace_id.is_none());
        assert_eq!(state.last_opened_workspace, Some(PathBuf::from("/tmp/old")));
        assert_eq!(state.recent_workspaces.len(), 1);
    }

    #[test]
    fn backward_compat_last_opened_synced() {
        let mut state = AppState::default();
        let id = WorkspaceId::new();
        state.activate_workspace(id, "/tmp/focused".into(), "Focused".to_string());

        state.sync_legacy_fields();

        assert_eq!(
            state.last_opened_workspace,
            Some(PathBuf::from("/tmp/focused"))
        );
    }
}

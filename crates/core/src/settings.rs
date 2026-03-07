use std::path::PathBuf;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Default, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct AppState {
    pub recent_workspaces: Vec<RecentWorkspace>,
    pub last_opened_workspace: Option<PathBuf>,
    pub global_settings: GlobalSettings,
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
}

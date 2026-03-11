pub mod assets;
pub mod notebook;
pub mod page;
#[cfg(test)]
mod page_test;
pub mod search;
pub mod section;
pub mod spellcheck;
pub mod sync;
pub mod tags;
pub mod trash;
pub mod workspace;

use serde::Serialize;

use opennote_core::id::WorkspaceId;

use crate::error::CommandError;
use crate::state::AppManagedState;

/// Resolve `workspace_id: Option<String>` para `WorkspaceId`.
/// `None` → usa o workspace em foco; `Some(id_str)` → parseia e usa diretamente.
pub(crate) fn resolve_workspace_id(
    state: &AppManagedState,
    workspace_id: Option<String>,
) -> Result<WorkspaceId, CommandError> {
    match workspace_id {
        Some(id_str) => {
            let uuid = uuid::Uuid::parse_str(&id_str)
                .map_err(|_| CommandError::Validation(format!("Invalid workspace ID: {id_str}")))?;
            Ok(WorkspaceId::from(uuid))
        }
        None => state.get_focused_id()?.ok_or(CommandError::NoWorkspace),
    }
}

#[derive(Debug, Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
}

#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: "Open Note".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_app_info_returns_correct_name() {
        let info = get_app_info();
        assert_eq!(info.name, "Open Note");
    }

    #[test]
    fn get_app_info_returns_valid_version() {
        let info = get_app_info();
        assert!(!info.version.is_empty());
    }
}

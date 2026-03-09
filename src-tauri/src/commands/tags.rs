use tauri::State;

use opennote_storage::engine::FsStorageEngine;

use crate::state::AppManagedState;

#[tauri::command]
pub fn list_all_tags(
    state: State<AppManagedState>,
    workspace_id: Option<String>,
) -> Result<Vec<String>, String> {
    let id = super::resolve_workspace_id(&state, workspace_id).map_err(|e| e.to_string())?;
    let root = state
        .get_workspace_root_by_id(&id)
        .map_err(|e| e.to_string())?;
    FsStorageEngine::list_all_tags(&root).map_err(|e| e.to_string())
}

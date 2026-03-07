use tauri::State;

use opennote_storage::engine::FsStorageEngine;

use crate::state::AppManagedState;

#[tauri::command]
pub fn list_all_tags(state: State<AppManagedState>) -> Result<Vec<String>, String> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::list_all_tags(&root).map_err(|e| e.to_string())
}

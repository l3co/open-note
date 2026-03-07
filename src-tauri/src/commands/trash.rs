use tauri::State;

use opennote_core::trash::TrashItem;
use opennote_storage::engine::FsStorageEngine;

use crate::state::AppManagedState;

#[tauri::command]
pub fn list_trash_items(state: State<AppManagedState>) -> Result<Vec<TrashItem>, String> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::list_trash_items(&root).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn restore_from_trash(
    state: State<AppManagedState>,
    trash_item_id: String,
) -> Result<(), String> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::restore_from_trash(&root, &trash_item_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn permanently_delete(
    state: State<AppManagedState>,
    trash_item_id: String,
) -> Result<(), String> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::permanently_delete(&root, &trash_item_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn empty_trash(state: State<AppManagedState>) -> Result<(), String> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::empty_trash(&root).map_err(|e| e.to_string())
}

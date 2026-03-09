use tauri::State;

use opennote_core::id::NotebookId;
use opennote_core::notebook::Notebook;
use opennote_storage::engine::FsStorageEngine;

use crate::error::CommandError;
use crate::state::AppManagedState;

#[tauri::command]
pub fn list_notebooks(
    state: State<AppManagedState>,
    workspace_id: Option<String>,
) -> Result<Vec<Notebook>, CommandError> {
    let id = super::resolve_workspace_id(&state, workspace_id)?;
    let root = state.get_workspace_root_by_id(&id)?;
    FsStorageEngine::list_notebooks(&root).map_err(CommandError::from)
}

#[tauri::command]
pub fn create_notebook(
    state: State<AppManagedState>,
    name: String,
    workspace_id: Option<String>,
) -> Result<Notebook, CommandError> {
    let id = super::resolve_workspace_id(&state, workspace_id)?;
    let root = state.get_workspace_root_by_id(&id)?;
    FsStorageEngine::create_notebook(&root, &name).map_err(CommandError::from)
}

#[tauri::command]
pub fn rename_notebook(
    state: State<AppManagedState>,
    id: NotebookId,
    name: String,
    workspace_id: Option<String>,
) -> Result<Notebook, CommandError> {
    let ws_id = super::resolve_workspace_id(&state, workspace_id)?;
    let root = state.get_workspace_root_by_id(&ws_id)?;
    FsStorageEngine::rename_notebook(&root, id, &name).map_err(CommandError::from)
}

#[tauri::command]
pub fn delete_notebook(
    state: State<AppManagedState>,
    id: NotebookId,
    workspace_id: Option<String>,
) -> Result<(), CommandError> {
    let ws_id = super::resolve_workspace_id(&state, workspace_id)?;
    let root = state.get_workspace_root_by_id(&ws_id)?;
    FsStorageEngine::delete_notebook(&root, id).map_err(CommandError::from)
}

#[tauri::command]
pub fn reorder_notebooks(
    state: State<AppManagedState>,
    order: Vec<(NotebookId, u32)>,
    workspace_id: Option<String>,
) -> Result<(), CommandError> {
    let id = super::resolve_workspace_id(&state, workspace_id)?;
    let root = state.get_workspace_root_by_id(&id)?;
    FsStorageEngine::reorder_notebooks(&root, &order).map_err(CommandError::from)
}

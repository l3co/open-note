use tauri::State;

use opennote_core::id::NotebookId;
use opennote_core::notebook::Notebook;
use opennote_storage::engine::FsStorageEngine;

use crate::error::CommandError;
use crate::state::AppManagedState;

#[tauri::command]
pub fn list_notebooks(state: State<AppManagedState>) -> Result<Vec<Notebook>, CommandError> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::list_notebooks(&root).map_err(CommandError::from)
}

#[tauri::command]
pub fn create_notebook(
    state: State<AppManagedState>,
    name: String,
) -> Result<Notebook, CommandError> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::create_notebook(&root, &name).map_err(CommandError::from)
}

#[tauri::command]
pub fn rename_notebook(
    state: State<AppManagedState>,
    id: NotebookId,
    name: String,
) -> Result<Notebook, CommandError> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::rename_notebook(&root, id, &name).map_err(CommandError::from)
}

#[tauri::command]
pub fn delete_notebook(state: State<AppManagedState>, id: NotebookId) -> Result<(), CommandError> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::delete_notebook(&root, id).map_err(CommandError::from)
}

#[tauri::command]
pub fn reorder_notebooks(
    state: State<AppManagedState>,
    order: Vec<(NotebookId, u32)>,
) -> Result<(), CommandError> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::reorder_notebooks(&root, &order).map_err(CommandError::from)
}

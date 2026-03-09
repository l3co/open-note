use log::{error, info};
use tauri::State;

use opennote_core::id::{NotebookId, SectionId};
use opennote_core::section::Section;
use opennote_storage::engine::FsStorageEngine;

use crate::error::CommandError;
use crate::state::AppManagedState;

#[tauri::command]
pub fn list_sections(
    state: State<AppManagedState>,
    notebook_id: NotebookId,
) -> Result<Vec<Section>, CommandError> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::list_sections(&root, notebook_id).map_err(CommandError::from)
}

#[tauri::command]
pub fn create_section(
    state: State<AppManagedState>,
    notebook_id: NotebookId,
    name: String,
) -> Result<Section, CommandError> {
    info!("Creating section '{}' in notebook {}", name, notebook_id);
    let root = state.get_workspace_root()?;

    FsStorageEngine::create_section(&root, notebook_id, &name).map_err(|error| {
        error!("Failed to create section: {}", error);
        CommandError::from(error)
    })
}

#[tauri::command]
pub fn rename_section(
    state: State<AppManagedState>,
    id: SectionId,
    name: String,
) -> Result<Section, CommandError> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::rename_section(&root, id, &name).map_err(CommandError::from)
}

#[tauri::command]
pub fn delete_section(state: State<AppManagedState>, id: SectionId) -> Result<(), CommandError> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::delete_section(&root, id).map_err(CommandError::from)
}

#[tauri::command]
pub fn reorder_sections(
    state: State<AppManagedState>,
    order: Vec<(SectionId, u32)>,
) -> Result<(), CommandError> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::reorder_sections(&root, &order).map_err(CommandError::from)
}

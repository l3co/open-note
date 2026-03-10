use log::{error, info, warn};
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
    workspace_id: Option<String>,
) -> Result<Vec<Section>, CommandError> {
    let ws_id = super::resolve_workspace_id(&state, workspace_id)?;
    let root = state.get_workspace_root_by_id(&ws_id)?;
    FsStorageEngine::list_sections(&root, notebook_id).map_err(CommandError::from)
}

#[tauri::command]
pub fn create_section(
    state: State<AppManagedState>,
    notebook_id: NotebookId,
    name: String,
    workspace_id: Option<String>,
) -> Result<Section, CommandError> {
    info!("Creating section '{}' in notebook {}", name, notebook_id);
    let ws_id = super::resolve_workspace_id(&state, workspace_id)?;
    let root = state.get_workspace_root_by_id(&ws_id)?;

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
    workspace_id: Option<String>,
) -> Result<Section, CommandError> {
    let ws_id = super::resolve_workspace_id(&state, workspace_id)?;
    let root = state.get_workspace_root_by_id(&ws_id)?;
    FsStorageEngine::rename_section(&root, id, &name).map_err(CommandError::from)
}

#[tauri::command]
pub fn delete_section(
    state: State<AppManagedState>,
    id: SectionId,
    workspace_id: Option<String>,
) -> Result<(), CommandError> {
    let ws_id = super::resolve_workspace_id(&state, workspace_id)?;
    let root = state.get_workspace_root_by_id(&ws_id)?;
    FsStorageEngine::delete_section(&root, id).map_err(CommandError::from)
}

#[tauri::command]
pub fn reorder_sections(
    state: State<AppManagedState>,
    order: Vec<(SectionId, u32)>,
    workspace_id: Option<String>,
) -> Result<(), CommandError> {
    let ws_id = super::resolve_workspace_id(&state, workspace_id)?;
    let root = state.get_workspace_root_by_id(&ws_id)?;
    FsStorageEngine::reorder_sections(&root, &order).map_err(CommandError::from)
}

#[tauri::command]
pub fn move_section(
    state: State<AppManagedState>,
    section_id: SectionId,
    target_notebook_id: NotebookId,
    workspace_id: Option<String>,
) -> Result<Section, CommandError> {
    let ws_id = super::resolve_workspace_id(&state, workspace_id)?;
    let root = state.get_workspace_root_by_id(&ws_id)?;
    FsStorageEngine::move_section(&root, section_id, target_notebook_id).map_err(|e| {
        warn!("Failed to move section: {}", e);
        CommandError::from(e)
    })
}

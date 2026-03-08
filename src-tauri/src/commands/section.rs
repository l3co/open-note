use log::{error, info};
use tauri::State;

use opennote_core::id::{NotebookId, SectionId};
use opennote_core::section::Section;
use opennote_storage::engine::FsStorageEngine;

use crate::state::AppManagedState;

#[tauri::command]
pub fn list_sections(
    state: State<AppManagedState>,
    notebook_id: NotebookId,
) -> Result<Vec<Section>, String> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::list_sections(&root, notebook_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_section(
    state: State<AppManagedState>,
    notebook_id: NotebookId,
    name: String,
) -> Result<Section, String> {
    info!("Creating section '{}' in notebook {}", name, notebook_id);
    let root = state.get_workspace_root()?;
    FsStorageEngine::create_section(&root, notebook_id, &name).map_err(|e| {
        error!("Failed to create section: {}", e);
        e.to_string()
    })
}

#[tauri::command]
pub fn rename_section(
    state: State<AppManagedState>,
    id: SectionId,
    name: String,
) -> Result<Section, String> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::rename_section(&root, id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_section(state: State<AppManagedState>, id: SectionId) -> Result<(), String> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::delete_section(&root, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reorder_sections(
    state: State<AppManagedState>,
    order: Vec<(SectionId, u32)>,
) -> Result<(), String> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::reorder_sections(&root, &order).map_err(|e| e.to_string())
}

use log::{debug, error, info};
use tauri::State;

use opennote_core::settings::{AppState, GlobalSettings};
use opennote_core::workspace::{Workspace, WorkspaceSettings};
use opennote_storage::engine::FsStorageEngine;

use crate::state::AppManagedState;

#[tauri::command]
pub fn get_app_state() -> Result<AppState, String> {
    debug!("Loading app state");
    FsStorageEngine::load_app_state().map_err(|e| {
        error!("Failed to load app state: {}", e);
        e.to_string()
    })
}

#[tauri::command]
pub fn create_workspace(
    state: State<AppManagedState>,
    path: String,
    name: String,
) -> Result<Workspace, String> {
    info!("Creating workspace '{}' at {}", name, path);
    let root = std::path::PathBuf::from(&path);
    let workspace = FsStorageEngine::create_workspace(&root, &name).map_err(|e| e.to_string())?;

    let mut app_state = FsStorageEngine::load_app_state().map_err(|e| e.to_string())?;
    app_state.add_recent_workspace(root.clone(), name);
    FsStorageEngine::save_app_state(&app_state).map_err(|e| e.to_string())?;

    state.set_workspace_root(Some(root.clone()))?;
    let _ = state.init_search_engine(&root);
    let _ = state.init_sync_coordinator(&root);
    Ok(workspace)
}

#[tauri::command]
pub fn open_workspace(state: State<AppManagedState>, path: String) -> Result<Workspace, String> {
    info!("Opening workspace at {}", path);
    let root = std::path::PathBuf::from(&path);
    let workspace = FsStorageEngine::open_workspace(&root).map_err(|e| e.to_string())?;

    let mut app_state = FsStorageEngine::load_app_state().map_err(|e| e.to_string())?;
    app_state.add_recent_workspace(root.clone(), workspace.name.clone());
    FsStorageEngine::save_app_state(&app_state).map_err(|e| e.to_string())?;

    state.set_workspace_root(Some(root.clone()))?;
    let _ = state.init_search_engine(&root);
    let _ = state.init_sync_coordinator(&root);
    Ok(workspace)
}

#[tauri::command]
pub fn close_workspace(state: State<AppManagedState>) -> Result<(), String> {
    info!("Closing workspace");
    let root = state.get_workspace_root()?;
    FsStorageEngine::close_workspace(&root).map_err(|e| e.to_string())?;
    state.set_workspace_root(None)?;
    Ok(())
}

#[tauri::command]
pub fn remove_recent_workspace(path: String) -> Result<(), String> {
    let mut app_state = FsStorageEngine::load_app_state().map_err(|e| e.to_string())?;
    app_state.remove_recent_workspace(&std::path::PathBuf::from(&path));
    FsStorageEngine::save_app_state(&app_state).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_workspace_settings(state: State<AppManagedState>) -> Result<WorkspaceSettings, String> {
    let root = state.get_workspace_root()?;
    let workspace = FsStorageEngine::load_workspace(&root).map_err(|e| e.to_string())?;
    Ok(workspace.settings)
}

#[tauri::command]
pub fn update_workspace_settings(
    state: State<AppManagedState>,
    settings: WorkspaceSettings,
) -> Result<(), String> {
    let root = state.get_workspace_root()?;
    let mut workspace = FsStorageEngine::load_workspace(&root).map_err(|e| e.to_string())?;
    workspace.settings = settings;
    FsStorageEngine::save_workspace(&workspace).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_global_settings() -> Result<GlobalSettings, String> {
    let app_state = FsStorageEngine::load_app_state().map_err(|e| e.to_string())?;
    Ok(app_state.global_settings)
}

#[tauri::command]
pub fn update_global_settings(settings: GlobalSettings) -> Result<(), String> {
    let mut app_state = FsStorageEngine::load_app_state().map_err(|e| e.to_string())?;
    app_state.global_settings = settings;
    FsStorageEngine::save_app_state(&app_state).map_err(|e| e.to_string())
}

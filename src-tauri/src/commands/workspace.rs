use log::{debug, error, info, warn};
use tauri::State;

use opennote_core::settings::{AppState, GlobalSettings};
use opennote_core::workspace::{Workspace, WorkspaceSettings};
use opennote_storage::engine::FsStorageEngine;

use crate::error::CommandError;
use crate::state::AppManagedState;

#[tauri::command]
pub fn get_app_state() -> Result<AppState, CommandError> {
    debug!("Loading app state");
    FsStorageEngine::load_app_state().map_err(|error| {
        error!("Failed to load app state: {}", error);
        CommandError::from(error)
    })
}

#[tauri::command]
pub fn create_workspace(
    state: State<AppManagedState>,
    path: String,
    name: String,
) -> Result<Workspace, CommandError> {
    info!("Creating workspace '{}' at {}", name, path);

    let parent = std::path::PathBuf::from(&path);
    let slug = opennote_storage::slug::slugify(&name);
    let slug = if slug.is_empty() {
        "workspace".to_string()
    } else {
        slug
    };
    let root = parent.join(&slug);

    if root.exists() && root.join("workspace.json").exists() {
        return Err(CommandError::Validation(format!(
            "Workspace already exists at {}",
            root.display()
        )));
    }

    let workspace = FsStorageEngine::create_workspace(&root, &name).map_err(CommandError::from)?;

    let mut app_state = FsStorageEngine::load_app_state().map_err(CommandError::from)?;
    app_state.add_recent_workspace(root.clone(), name);
    FsStorageEngine::save_app_state(&app_state).map_err(CommandError::from)?;

    state.set_workspace_root(Some(root.clone()))?;

    if let Err(error) = state.init_search_engine(&root) {
        warn!("Failed to initialize search engine: {}", error);
    }
    if let Err(error) = state.init_sync_coordinator(&root) {
        warn!("Failed to initialize sync coordinator: {}", error);
    }

    Ok(workspace)
}

#[tauri::command]
pub fn open_workspace(
    state: State<AppManagedState>,
    path: String,
) -> Result<Workspace, CommandError> {
    info!("Opening workspace at {}", path);

    let root = std::path::PathBuf::from(&path);
    let workspace = FsStorageEngine::open_workspace(&root).map_err(CommandError::from)?;

    let mut app_state = FsStorageEngine::load_app_state().map_err(CommandError::from)?;
    app_state.add_recent_workspace(root.clone(), workspace.name.clone());
    FsStorageEngine::save_app_state(&app_state).map_err(CommandError::from)?;

    state.set_workspace_root(Some(root.clone()))?;

    if let Err(error) = state.init_search_engine(&root) {
        warn!("Failed to initialize search engine: {}", error);
    }
    if let Err(error) = state.init_sync_coordinator(&root) {
        warn!("Failed to initialize sync coordinator: {}", error);
    }

    Ok(workspace)
}

#[tauri::command]
pub fn close_workspace(state: State<AppManagedState>) -> Result<(), CommandError> {
    info!("Closing workspace");

    let root = state.get_workspace_root()?;
    FsStorageEngine::close_workspace(&root).map_err(CommandError::from)?;
    state.set_workspace_root(None)?;

    Ok(())
}

#[tauri::command]
pub fn remove_recent_workspace(path: String) -> Result<(), CommandError> {
    let mut app_state = FsStorageEngine::load_app_state().map_err(CommandError::from)?;
    app_state.remove_recent_workspace(&std::path::PathBuf::from(&path));
    FsStorageEngine::save_app_state(&app_state).map_err(CommandError::from)
}

#[tauri::command]
pub fn get_workspace_settings(
    state: State<AppManagedState>,
) -> Result<WorkspaceSettings, CommandError> {
    let root = state.get_workspace_root()?;
    let workspace = FsStorageEngine::load_workspace(&root).map_err(CommandError::from)?;

    Ok(workspace.settings)
}

#[tauri::command]
pub fn update_workspace_settings(
    state: State<AppManagedState>,
    settings: WorkspaceSettings,
) -> Result<(), CommandError> {
    let root = state.get_workspace_root()?;

    let mut workspace = FsStorageEngine::load_workspace(&root).map_err(CommandError::from)?;
    workspace.settings = settings;
    FsStorageEngine::save_workspace(&workspace).map_err(CommandError::from)
}

#[tauri::command]
pub fn get_global_settings() -> Result<GlobalSettings, CommandError> {
    let app_state = FsStorageEngine::load_app_state().map_err(CommandError::from)?;

    Ok(app_state.global_settings)
}

#[tauri::command]
pub fn update_global_settings(settings: GlobalSettings) -> Result<(), CommandError> {
    let mut app_state = FsStorageEngine::load_app_state().map_err(CommandError::from)?;
    app_state.global_settings = settings;
    FsStorageEngine::save_app_state(&app_state).map_err(CommandError::from)
}

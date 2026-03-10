use log::{debug, error, info, warn};
use tauri::State;

use opennote_core::settings::{ActiveWorkspace, AppState, GlobalSettings};
use opennote_core::workspace::{Workspace, WorkspaceSettings};
use opennote_storage::engine::FsStorageEngine;

use crate::error::CommandError;
use crate::state::{AppManagedState, WorkspaceContext};

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

    let mut workspace =
        FsStorageEngine::create_workspace(&root, &name).map_err(CommandError::from)?;

    match FsStorageEngine::create_notebook(&root, "Quick Notes") {
        Ok(qn_notebook) => {
            match FsStorageEngine::create_section(&root, qn_notebook.id, "Quick Notes") {
                Ok(qn_section) => {
                    workspace.settings.quick_notes_notebook_id = Some(qn_notebook.id);
                    workspace.settings.quick_notes_section_id = Some(qn_section.id);
                    if let Err(e) = FsStorageEngine::save_workspace(&workspace) {
                        warn!(
                            "Failed to persist Quick Notes IDs in workspace settings: {}",
                            e
                        );
                    }
                }
                Err(e) => warn!("Failed to create Quick Notes section: {}", e),
            }
        }
        Err(e) => warn!("Failed to create Quick Notes notebook: {}", e),
    }

    let mut app_state = FsStorageEngine::load_app_state().map_err(CommandError::from)?;
    app_state.add_recent_workspace(root.clone(), name.clone());
    app_state.activate_workspace(workspace.id, root.clone(), name.clone());
    FsStorageEngine::save_app_state(&app_state).map_err(CommandError::from)?;

    let mut ctx = WorkspaceContext::new(root.clone(), name);
    if let Err(error) = ctx.init_search() {
        warn!("Failed to initialize search engine: {}", error);
    }
    if let Err(error) = ctx.init_sync() {
        warn!("Failed to initialize sync coordinator: {}", error);
    }
    state.register_workspace(workspace.id, ctx)?;
    state.set_focused(Some(workspace.id))?;

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
    app_state.activate_workspace(workspace.id, root.clone(), workspace.name.clone());
    FsStorageEngine::save_app_state(&app_state).map_err(CommandError::from)?;

    if state.get_workspace_root_by_id(&workspace.id).is_ok() {
        state.set_focused(Some(workspace.id))?;
        return Ok(workspace);
    }

    let mut ctx = WorkspaceContext::new(root.clone(), workspace.name.clone());
    if let Err(error) = ctx.init_search() {
        warn!("Failed to initialize search engine: {}", error);
    }
    if let Err(error) = ctx.init_sync() {
        warn!("Failed to initialize sync coordinator: {}", error);
    }
    state.register_workspace(workspace.id, ctx)?;
    state.set_focused(Some(workspace.id))?;

    Ok(workspace)
}

#[tauri::command]
pub fn close_workspace(
    state: State<AppManagedState>,
    workspace_id: Option<String>,
) -> Result<(), CommandError> {
    info!("Closing workspace");

    let id = super::resolve_workspace_id(&state, workspace_id)?;
    let root = state.get_workspace_root_by_id(&id)?;
    FsStorageEngine::close_workspace(&root).map_err(CommandError::from)?;
    state.unregister_workspace(&id)?;

    let mut app_state = FsStorageEngine::load_app_state().map_err(CommandError::from)?;
    app_state.deactivate_workspace(&id);
    FsStorageEngine::save_app_state(&app_state).map_err(CommandError::from)?;

    Ok(())
}

#[tauri::command]
pub fn list_open_workspaces(
    state: State<AppManagedState>,
) -> Result<Vec<ActiveWorkspace>, CommandError> {
    let list = state.list_open_workspaces()?;
    Ok(list
        .into_iter()
        .map(|(id, name)| {
            let path = state.get_workspace_root_by_id(&id).unwrap_or_default();
            ActiveWorkspace {
                id,
                path,
                name,
                opened_at: chrono::Utc::now(),
            }
        })
        .collect())
}

#[tauri::command]
pub fn focus_workspace(
    state: State<AppManagedState>,
    workspace_id: String,
) -> Result<(), CommandError> {
    let id = super::resolve_workspace_id(&state, Some(workspace_id))?;
    state.get_workspace_root_by_id(&id)?;
    state.set_focused(Some(id))?;

    let mut app_state = FsStorageEngine::load_app_state().map_err(CommandError::from)?;
    let root = state.get_workspace_root_by_id(&id)?;
    if let Some(name) = state
        .list_open_workspaces()?
        .into_iter()
        .find(|(oid, _)| *oid == id)
        .map(|(_, name)| name)
    {
        app_state.activate_workspace(id, root, name);
        FsStorageEngine::save_app_state(&app_state).map_err(CommandError::from)?;
    }
    Ok(())
}

#[tauri::command]
pub fn switch_workspace(
    state: State<AppManagedState>,
    workspace_id: String,
) -> Result<Workspace, CommandError> {
    let id = super::resolve_workspace_id(&state, Some(workspace_id))?;
    let root = state.get_workspace_root_by_id(&id)?;
    state.set_focused(Some(id))?;
    FsStorageEngine::load_workspace(&root).map_err(CommandError::from)
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
    workspace_id: Option<String>,
) -> Result<WorkspaceSettings, CommandError> {
    let id = super::resolve_workspace_id(&state, workspace_id)?;
    let root = state.get_workspace_root_by_id(&id)?;
    let workspace = FsStorageEngine::load_workspace(&root).map_err(CommandError::from)?;
    Ok(workspace.settings)
}

#[tauri::command]
pub fn update_workspace_settings(
    state: State<AppManagedState>,
    settings: WorkspaceSettings,
    workspace_id: Option<String>,
) -> Result<(), CommandError> {
    let id = super::resolve_workspace_id(&state, workspace_id)?;
    let root = state.get_workspace_root_by_id(&id)?;
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

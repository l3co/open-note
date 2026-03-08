use tauri::State;

use opennote_sync::providers;
use opennote_sync::types::{
    ConflictResolution, ProviderInfo, SyncConflict, SyncPreferences, SyncStatus,
};

use crate::state::AppManagedState;

#[tauri::command]
pub fn get_sync_providers(state: State<AppManagedState>) -> Result<Vec<ProviderInfo>, String> {
    let providers = vec![
        ProviderInfo {
            name: "google_drive".to_string(),
            display_name: "Google Drive".to_string(),
            connected: false,
            user_email: None,
            last_synced_at: None,
        },
        ProviderInfo {
            name: "onedrive".to_string(),
            display_name: "OneDrive".to_string(),
            connected: false,
            user_email: None,
            last_synced_at: None,
        },
        ProviderInfo {
            name: "dropbox".to_string(),
            display_name: "Dropbox".to_string(),
            connected: false,
            user_email: None,
            last_synced_at: None,
        },
    ];

    let coordinator = state
        .sync_coordinator
        .lock()
        .map_err(|e| format!("Lock error: {e}"))?;
    if let Some(ref coord) = *coordinator {
        if let Some(info) = coord.get_provider_info() {
            return Ok(providers
                .into_iter()
                .map(|mut p| {
                    if p.name == info.name {
                        p.connected = info.connected;
                        p.user_email = info.user_email.clone();
                        p.last_synced_at = info.last_synced_at;
                    }
                    p
                })
                .collect());
        }
    }

    Ok(providers)
}

#[tauri::command]
pub fn get_sync_status(state: State<AppManagedState>) -> Result<SyncStatus, String> {
    let coordinator = state
        .sync_coordinator
        .lock()
        .map_err(|e| format!("Lock error: {e}"))?;
    match *coordinator {
        Some(ref coord) => Ok(coord.get_status().clone()),
        None => Ok(SyncStatus::default()),
    }
}

#[tauri::command]
pub fn get_sync_config(state: State<AppManagedState>) -> Result<SyncPreferences, String> {
    let coordinator = state
        .sync_coordinator
        .lock()
        .map_err(|e| format!("Lock error: {e}"))?;
    match *coordinator {
        Some(ref coord) => Ok(coord.get_preferences().clone()),
        None => Ok(SyncPreferences::default()),
    }
}

#[tauri::command]
pub fn set_sync_config(
    state: State<AppManagedState>,
    config: SyncPreferences,
) -> Result<(), String> {
    let mut coordinator = state
        .sync_coordinator
        .lock()
        .map_err(|e| format!("Lock error: {e}"))?;
    if let Some(ref mut coord) = *coordinator {
        if let Some(provider_type) = config.provider {
            let provider = providers::create_provider(provider_type);
            coord.set_provider(provider);
        }
        coord.set_preferences(config);
        Ok(())
    } else {
        Err("Sync coordinator not initialized".to_string())
    }
}

#[tauri::command]
pub fn get_sync_conflicts(state: State<AppManagedState>) -> Result<Vec<SyncConflict>, String> {
    let coordinator = state
        .sync_coordinator
        .lock()
        .map_err(|e| format!("Lock error: {e}"))?;
    match *coordinator {
        Some(ref coord) => Ok(coord.get_conflicts().to_vec()),
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
pub fn resolve_sync_conflict(
    state: State<AppManagedState>,
    conflict_id: String,
    resolution: ConflictResolution,
) -> Result<(), String> {
    let mut coordinator = state
        .sync_coordinator
        .lock()
        .map_err(|e| format!("Lock error: {e}"))?;
    if let Some(ref mut coord) = *coordinator {
        coord
            .resolve_conflict(&conflict_id, resolution)
            .map_err(|e| e.to_string())
    } else {
        Err("Sync coordinator not initialized".to_string())
    }
}

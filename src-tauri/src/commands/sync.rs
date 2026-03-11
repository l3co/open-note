use std::path::PathBuf;

use serde::Serialize;
use tauri::State;
use tauri_plugin_opener::OpenerExt;

use opennote_sync::providers;
use opennote_sync::types::{
    ConflictResolution, ProviderInfo, SyncConflict, SyncPreferences, SyncProviderType, SyncStatus,
};

use crate::error::CommandError;
use crate::state::AppManagedState;

fn parse_provider_type(name: &str) -> Result<SyncProviderType, String> {
    match name {
        "google_drive" => Ok(SyncProviderType::GoogleDrive),
        "onedrive" => Ok(SyncProviderType::OneDrive),
        "dropbox" => Ok(SyncProviderType::Dropbox),
        _ => Err(format!("Provider desconhecido: {name}")),
    }
}

/// Inicia o fluxo OAuth2 completo: abre browser → aguarda callback → troca code
/// por token → armazena no keychain → retorna o email do usuário autenticado.
#[tauri::command]
pub async fn connect_provider(
    app: tauri::AppHandle,
    state: State<'_, AppManagedState>,
    provider_name: String,
) -> Result<String, String> {
    let provider_type = parse_provider_type(&provider_name)?;

    let missing: Vec<&str> = match provider_type {
        SyncProviderType::GoogleDrive => ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]
            .iter()
            .filter(|k| std::env::var(k).is_err())
            .copied()
            .collect(),
        SyncProviderType::OneDrive => ["ONEDRIVE_CLIENT_ID"]
            .iter()
            .filter(|k| std::env::var(k).is_err())
            .copied()
            .collect(),
        SyncProviderType::Dropbox => ["DROPBOX_CLIENT_ID", "DROPBOX_CLIENT_SECRET"]
            .iter()
            .filter(|k| std::env::var(k).is_err())
            .copied()
            .collect(),
    };

    if !missing.is_empty() {
        return Err(format!(
            "Variáveis de ambiente não encontradas: {}. Verifique a Run/Debug Configuration.",
            missing.join(", ")
        ));
    }

    let provider = providers::create_provider(provider_type);
    let auth_url = provider.auth_url();

    app.opener()
        .open_url(&auth_url, None::<&str>)
        .map_err(|e| format!("Falha ao abrir browser: {e}"))?;

    let code = opennote_sync::oauth_server::wait_for_oauth_code()
        .await
        .map_err(|e| e.to_string())?;

    let token = provider
        .exchange_code(&code)
        .await
        .map_err(|e| e.to_string())?;

    let email = provider.get_user_email(&token).await.unwrap_or(None);

    opennote_sync::token_store::store_token(&provider_name, &token).map_err(|e| e.to_string())?;

    if let Ok(Some(id)) = state.get_focused_id() {
        let _ = state.with_workspace_mut(&id, |ctx| {
            if let Some(ref mut coord) = ctx.sync_coordinator {
                let mut prefs = coord.get_preferences().clone();
                prefs.provider = Some(provider_type);
                prefs.enabled = true;
                coord.set_provider(providers::create_provider(provider_type));
                coord.set_preferences(prefs);
            }
            Ok(())
        });
    }

    Ok(email.unwrap_or_else(|| "conectado".to_string()))
}

/// Revoga o token OAuth2, remove do keychain e desconecta o provider do workspace.
#[tauri::command]
pub async fn disconnect_provider(
    state: State<'_, AppManagedState>,
    provider_name: String,
) -> Result<(), String> {
    let provider_type = parse_provider_type(&provider_name)?;

    if let Ok(Some(token)) = opennote_sync::token_store::get_token(&provider_name) {
        let provider = providers::create_provider(provider_type);
        let _ = provider.revoke(&token).await;
    }

    opennote_sync::token_store::delete_token(&provider_name).map_err(|e| e.to_string())?;

    if let Ok(Some(id)) = state.get_focused_id() {
        let _ = state.with_workspace_mut(&id, |ctx| {
            if let Some(ref mut coord) = ctx.sync_coordinator {
                coord.clear_provider();
                let mut prefs = coord.get_preferences().clone();
                prefs.provider = None;
                prefs.enabled = false;
                coord.set_preferences(prefs);
            }
            Ok(())
        });
    }

    Ok(())
}

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

    let Ok(Some(id)) = state.get_focused_id() else {
        return Ok(providers);
    };
    let result = state.with_workspace(&id, |ctx| {
        if let Some(ref coord) = ctx.sync_coordinator {
            if let Some(info) = coord.get_provider_info() {
                return Ok(Some(info));
            }
        }
        Ok(None)
    });
    match result {
        Ok(Some(info)) => Ok(providers
            .into_iter()
            .map(|mut p| {
                if p.name == info.name {
                    p.connected = info.connected;
                    p.user_email = info.user_email.clone();
                    p.last_synced_at = info.last_synced_at;
                }
                p
            })
            .collect()),
        _ => Ok(providers),
    }
}

#[tauri::command]
pub fn get_sync_status(state: State<AppManagedState>) -> Result<SyncStatus, String> {
    let Ok(Some(id)) = state.get_focused_id() else {
        return Ok(SyncStatus::default());
    };
    state
        .with_workspace(&id, |ctx| match ctx.sync_coordinator {
            Some(ref coord) => Ok(coord.get_status().clone()),
            None => Ok(SyncStatus::default()),
        })
        .map_err(|e: CommandError| e.to_string())
}

#[tauri::command]
pub fn get_sync_config(state: State<AppManagedState>) -> Result<SyncPreferences, String> {
    let Ok(Some(id)) = state.get_focused_id() else {
        return Ok(SyncPreferences::default());
    };
    state
        .with_workspace(&id, |ctx| match ctx.sync_coordinator {
            Some(ref coord) => Ok(coord.get_preferences().clone()),
            None => Ok(SyncPreferences::default()),
        })
        .map_err(|e: CommandError| e.to_string())
}

#[tauri::command]
pub fn set_sync_config(
    state: State<AppManagedState>,
    config: SyncPreferences,
) -> Result<(), String> {
    let id = state
        .get_focused_id()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No workspace open".to_string())?;
    state
        .with_workspace_mut(&id, |ctx| {
            if let Some(ref mut coord) = ctx.sync_coordinator {
                if let Some(provider_type) = config.provider {
                    let provider = providers::create_provider(provider_type);
                    coord.set_provider(provider);
                }
                coord.set_preferences(config);
                Ok(())
            } else {
                Err(CommandError::Internal(
                    "Sync coordinator not initialized".to_string(),
                ))
            }
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_sync_conflicts(state: State<AppManagedState>) -> Result<Vec<SyncConflict>, String> {
    let Ok(Some(id)) = state.get_focused_id() else {
        return Ok(Vec::new());
    };
    state
        .with_workspace(&id, |ctx| match ctx.sync_coordinator {
            Some(ref coord) => Ok(coord.get_conflicts().to_vec()),
            None => Ok(Vec::new()),
        })
        .map_err(|e: CommandError| e.to_string())
}

#[tauri::command]
pub fn resolve_sync_conflict(
    state: State<AppManagedState>,
    conflict_id: String,
    resolution: ConflictResolution,
) -> Result<(), String> {
    let id = state
        .get_focused_id()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No workspace open".to_string())?;
    state
        .with_workspace_mut(&id, |ctx| {
            if let Some(ref mut coord) = ctx.sync_coordinator {
                coord
                    .resolve_conflict(&conflict_id, resolution)
                    .map_err(|e| CommandError::Internal(e.to_string()))
            } else {
                Err(CommandError::Internal(
                    "Sync coordinator not initialized".to_string(),
                ))
            }
        })
        .map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConnectionStatus {
    pub name: String,
    pub display_name: String,
    pub connected: bool,
    pub email: Option<String>,
    pub error_msg: Option<String>,
}

/// Lê o keychain e retorna o status de conexão de cada provider.
#[tauri::command]
pub fn get_provider_status() -> Result<Vec<ProviderConnectionStatus>, String> {
    let providers_info = [
        ("google_drive", "Google Drive"),
        ("onedrive", "OneDrive"),
        ("dropbox", "Dropbox"),
    ];

    let statuses = providers_info
        .iter()
        .map(
            |(name, display)| match opennote_sync::token_store::get_token(name) {
                Ok(Some(_)) => ProviderConnectionStatus {
                    name: name.to_string(),
                    display_name: display.to_string(),
                    connected: true,
                    email: None,
                    error_msg: None,
                },
                Ok(None) => ProviderConnectionStatus {
                    name: name.to_string(),
                    display_name: display.to_string(),
                    connected: false,
                    email: None,
                    error_msg: None,
                },
                Err(e) => ProviderConnectionStatus {
                    name: name.to_string(),
                    display_name: display.to_string(),
                    connected: false,
                    email: None,
                    error_msg: Some(e.to_string()),
                },
            },
        )
        .collect();

    Ok(statuses)
}

/// Desconecta sem precisar de workspace aberto.
#[tauri::command]
pub async fn disconnect_provider_by_name(provider_name: String) -> Result<(), String> {
    let provider_type = parse_provider_type(&provider_name)?;

    if let Ok(Some(token)) = opennote_sync::token_store::get_token(&provider_name) {
        let provider = providers::create_provider(provider_type);
        let _ = provider.revoke(&token).await;
    }

    opennote_sync::token_store::delete_token(&provider_name).map_err(|e| e.to_string())
}

/// Faz upload inicial de todos os arquivos do workspace para o cloud provider.
/// Retorna o número de arquivos enviados com sucesso.
#[tauri::command]
pub async fn sync_initial_upload(
    state: State<'_, AppManagedState>,
    provider_name: String,
) -> Result<u32, String> {
    let token = opennote_sync::token_store::get_token(&provider_name)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Não conectado a {provider_name}"))?;

    let provider_type = parse_provider_type(&provider_name)?;
    let provider = providers::create_provider(provider_type);

    let workspace_root = state.get_workspace_root().map_err(|e| e.to_string())?;

    let workspace_name = workspace_root
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("workspace")
        .to_string();

    let files = collect_sync_files(&workspace_root);

    let mut uploaded = 0u32;
    for file_path in files {
        let relative = file_path
            .strip_prefix(&workspace_root)
            .unwrap_or(&file_path);
        let remote_path = format!(
            "OpenNote/{}/{}",
            workspace_name,
            relative.to_string_lossy().replace('\\', "/")
        );

        match std::fs::read(&file_path) {
            Ok(content) => {
                if provider
                    .upload_file(&token, &remote_path, &content)
                    .await
                    .is_ok()
                {
                    uploaded += 1;
                }
            }
            Err(_) => continue,
        }
    }

    Ok(uploaded)
}

fn collect_sync_files(root: &PathBuf) -> Vec<PathBuf> {
    let mut result = Vec::new();
    collect_recursive(root, &mut result);
    result
}

fn collect_recursive(dir: &PathBuf, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        if name_str.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            collect_recursive(&path, out);
        } else if path.is_file() {
            let keep = name_str.ends_with(".opn.json")
                || name_str == "workspace.json"
                || name_str == "notebook.json"
                || name_str == "section.json";
            if keep {
                out.push(path);
            }
        }
    }
}

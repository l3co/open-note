use std::collections::HashMap;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::State;
use tauri_plugin_opener::OpenerExt;

use opennote_sync::manifest::{
    compute_hash, detect_changes, should_sync_file, SyncFileEntry, SyncManifest,
};
use opennote_sync::providers;
use opennote_sync::types::{
    ConflictResolution, ProviderInfo, RemoteWorkspaceInfo, SyncBidirectionalResult, SyncConflict,
    SyncPreferences, SyncProviderType, SyncStatus,
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

    let provider = providers::create_provider(provider_type);

    if !provider.has_credentials() {
        let missing_vars = match provider_type {
            SyncProviderType::GoogleDrive => "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET",
            SyncProviderType::OneDrive => "ONEDRIVE_CLIENT_ID",
            SyncProviderType::Dropbox => "DROPBOX_CLIENT_ID, DROPBOX_CLIENT_SECRET",
        };
        return Err(format!(
            "Variáveis de ambiente não encontradas: {}. Verifique a Run/Debug Configuration.",
            missing_vars
        ));
    }
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
        if let Err(e) = state.with_workspace_mut(&id, |ctx| {
            if let Some(ref mut coord) = ctx.sync_coordinator {
                let mut prefs = coord.get_preferences().clone();
                prefs.provider = Some(provider_type);
                prefs.enabled = true;
                coord.set_provider(providers::create_provider(provider_type));
                coord.set_preferences(prefs);
            }
            Ok(())
        }) {
            log::warn!("[connect_provider] Falha ao atualizar coordinator: {e}");
        }
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
        if let Err(e) = state.with_workspace_mut(&id, |ctx| {
            if let Some(ref mut coord) = ctx.sync_coordinator {
                coord.clear_provider();
                let mut prefs = coord.get_preferences().clone();
                prefs.provider = None;
                prefs.enabled = false;
                coord.set_preferences(prefs);
            }
            Ok(())
        }) {
            log::warn!("[disconnect_provider] Falha ao atualizar coordinator: {e}");
        }
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

/// Lists workspaces (top-level folders) stored in the cloud under `OpenNote/`.
#[tauri::command]
pub async fn list_remote_workspaces(
    provider_name: String,
) -> Result<Vec<RemoteWorkspaceInfo>, String> {
    let token = opennote_sync::token_store::get_token(&provider_name)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Não conectado a {provider_name}"))?;

    let provider_type = parse_provider_type(&provider_name)?;
    let provider = providers::create_provider(provider_type);

    let folder_names = provider
        .list_remote_folders(&token, "OpenNote")
        .await
        .unwrap_or_default();

    let workspaces = folder_names
        .into_iter()
        .map(|name| RemoteWorkspaceInfo {
            name: name.clone(),
            provider: provider_name.clone(),
            file_count: None,
        })
        .collect();

    Ok(workspaces)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadResult {
    pub count: u32,
    pub local_path: String,
}

/// Downloads all files from a remote workspace to the given local directory.
/// Returns the number of files downloaded and the resolved local path.
#[tauri::command]
pub async fn download_workspace(
    provider_name: String,
    workspace_name: String,
    dest_path: String,
) -> Result<DownloadResult, String> {
    let token = opennote_sync::token_store::get_token(&provider_name)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Não conectado a {provider_name}"))?;

    let provider_type = parse_provider_type(&provider_name)?;
    let provider = providers::create_provider(provider_type);

    let remote_root = format!("OpenNote/{}", workspace_name);
    let remote_files = provider
        .list_all_remote_files(&token, &remote_root)
        .await
        .map_err(|e| e.to_string())?;

    let dest = PathBuf::from(&dest_path);
    std::fs::create_dir_all(&dest).map_err(|e| {
        format!(
            "Não foi possível criar o diretório '{}': {e}",
            dest.display()
        )
    })?;

    // Explicitly set directory permissions on Unix so the workspace is writable.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&dest, std::fs::Permissions::from_mode(0o755));
    }

    let mut downloaded = 0u32;
    let mut last_write_error: Option<String> = None;

    for remote_file in &remote_files {
        let relative = remote_file
            .path
            .trim_start_matches(&remote_root)
            .trim_start_matches('/');

        // Skip entries that resolve to the workspace root itself (folder entries).
        if relative.is_empty() {
            continue;
        }

        let local_path = dest.join(relative);

        if let Some(parent) = local_path.parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                last_write_error = Some(format!(
                    "Não foi possível criar '{}': {e}",
                    parent.display()
                ));
                continue;
            }
            // Ensure subdirectories are also writable on Unix.
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = std::fs::set_permissions(parent, std::fs::Permissions::from_mode(0o755));
            }
        }

        match provider.download_remote_file(&token, remote_file).await {
            Ok(content) => match std::fs::write(&local_path, &content) {
                Ok(()) => {
                    // Ensure files are readable/writable by the owner on Unix.
                    #[cfg(unix)]
                    {
                        use std::os::unix::fs::PermissionsExt;
                        let _ = std::fs::set_permissions(
                            &local_path,
                            std::fs::Permissions::from_mode(0o644),
                        );
                    }
                    downloaded += 1;
                }
                Err(e) => {
                    last_write_error = Some(format!(
                        "Não foi possível salvar '{}': {e}",
                        local_path.display()
                    ));
                }
            },
            Err(e) => {
                last_write_error = Some(format!("Erro ao baixar '{}': {e}", remote_file.path));
            }
        }
    }

    // If workspace.json was never written, surface the error so the user understands
    // why the workspace cannot be opened afterwards.
    let ws_json = dest.join("workspace.json");
    if !ws_json.exists() {
        let reason = last_write_error
            .unwrap_or_else(|| "nenhum arquivo foi encontrado no workspace remoto".to_string());
        return Err(format!(
            "workspace.json não encontrado após o download. {reason}"
        ));
    }

    Ok(DownloadResult {
        count: downloaded,
        local_path: dest.to_string_lossy().into_owned(),
    })
}

/// Returns the ~/.opennote/ directory path.
#[tauri::command]
pub fn get_opennote_dir() -> String {
    opennote_sync::token_store::opennote_dir()
        .to_string_lossy()
        .into_owned()
}

/// Returns the cross-platform default sync directory: `{documents_dir}/OpenNote`.
/// Uses the `dirs` crate which respects OS locale and XDG conventions.
///
/// - **Linux**: `$XDG_DOCUMENTS_DIR/OpenNote` (e.g. `/home/user/Documentos/OpenNote`)
/// - **macOS**: `$HOME/Documents/OpenNote`
/// - **Windows**: `{FOLDERID_Documents}\OpenNote`
/// - **Android/iOS**: Falls back to home/data dir + `Documents/OpenNote`
fn default_sync_dir() -> PathBuf {
    let doc_dir = dirs::document_dir().unwrap_or_else(|| {
        // Fallback: home_dir/Documents (covers Android/iOS edge cases)
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Documents")
    });
    doc_dir.join("OpenNote")
}

/// Returns the resolved default sync directory path as a string.
#[tauri::command]
pub fn get_default_sync_dir() -> String {
    default_sync_dir().to_string_lossy().into_owned()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadedWorkspace {
    pub name: String,
    pub local_path: String,
}

/// Lists workspaces previously downloaded to `{documents_dir}/OpenNote/`.
#[tauri::command]
pub fn list_downloaded_workspaces() -> Vec<DownloadedWorkspace> {
    let dir = default_sync_dir();
    let Ok(entries) = std::fs::read_dir(&dir) else {
        return vec![];
    };
    entries
        .flatten()
        .filter(|e| e.path().is_dir())
        .map(|e| DownloadedWorkspace {
            name: e.file_name().to_string_lossy().into_owned(),
            local_path: e.path().to_string_lossy().into_owned(),
        })
        .collect()
}

/// Performs a full bidirectional sync of the current workspace with the cloud provider.
/// Uses manifest-based change detection to upload/download only what changed.
#[tauri::command]
pub async fn sync_bidirectional(
    state: State<'_, AppManagedState>,
    provider_name: String,
) -> Result<SyncBidirectionalResult, String> {
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

    let remote_root = format!("OpenNote/{}", workspace_name);

    // ── Collect local files ──────────────────────────────────────────────────
    let mut local_map: HashMap<String, (String, chrono::DateTime<chrono::Utc>)> = HashMap::new();
    for path in collect_sync_files(&workspace_root) {
        let relative = path
            .strip_prefix(&workspace_root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        if let Ok(content) = std::fs::read(&path) {
            let hash = compute_hash(&content);
            let modified = path
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .map(|t| t.into())
                .unwrap_or_else(chrono::Utc::now);
            local_map.insert(relative, (hash, modified));
        }
    }

    // ── Collect remote files ─────────────────────────────────────────────────
    let remote_files = provider
        .list_all_remote_files(&token, &remote_root)
        .await
        .unwrap_or_default();

    let mut remote_map: HashMap<String, (String, chrono::DateTime<chrono::Utc>)> = HashMap::new();
    let mut remote_by_path: HashMap<String, opennote_sync::types::RemoteFile> = HashMap::new();
    for rf in remote_files {
        let relative = rf
            .path
            .trim_start_matches(&remote_root)
            .trim_start_matches('/')
            .to_string();
        if should_sync_file(&relative) {
            remote_map.insert(relative.clone(), (rf.hash.clone(), rf.modified_at));
            remote_by_path.insert(relative, rf);
        }
    }

    // ── Load manifest ────────────────────────────────────────────────────────
    let manifest_path = workspace_root.join(".opennote").join("sync_manifest.json");
    let mut manifest = SyncManifest::load(&manifest_path).unwrap_or_default();

    // ── Detect changes ───────────────────────────────────────────────────────
    let changes = detect_changes(&local_map, &remote_map, &manifest);

    let mut uploaded = 0u32;
    let mut downloaded = 0u32;
    let mut conflicts = 0u32;
    let mut errors: Vec<String> = Vec::new();

    for change in &changes {
        use opennote_sync::types::FileChangeKind;
        let local_path = workspace_root.join(&change.path);
        let remote_path = format!("{}/{}", remote_root, change.path);

        match change.kind {
            // Upload local → remote
            FileChangeKind::LocalOnly | FileChangeKind::LocalModified => {
                match std::fs::read(&local_path) {
                    Ok(content) => {
                        match provider.upload_file(&token, &remote_path, &content).await {
                            Ok(uploaded_file) => {
                                let local_hash = compute_hash(&content);
                                let modified = local_path
                                    .metadata()
                                    .ok()
                                    .and_then(|m| m.modified().ok())
                                    .map(|t| t.into())
                                    .unwrap_or_else(chrono::Utc::now);
                                manifest.update_entry(
                                    &change.path,
                                    SyncFileEntry {
                                        local_hash: local_hash.clone(),
                                        remote_hash: uploaded_file.hash.clone(),
                                        local_modified_at: modified,
                                        remote_modified_at: uploaded_file.modified_at,
                                        synced_at: chrono::Utc::now(),
                                    },
                                );
                                uploaded += 1;
                            }
                            Err(e) => errors.push(format!("Upload {}: {}", change.path, e)),
                        }
                    }
                    Err(e) => errors.push(format!("Read {}: {}", change.path, e)),
                }
            }

            // Download remote → local
            FileChangeKind::RemoteOnly | FileChangeKind::RemoteModified => {
                if let Some(rf) = remote_by_path.get(&change.path) {
                    match provider.download_remote_file(&token, rf).await {
                        Ok(content) => {
                            if let Some(parent) = local_path.parent() {
                                let _ = std::fs::create_dir_all(parent);
                            }
                            match std::fs::write(&local_path, &content) {
                                Ok(()) => {
                                    // Garante permissão de leitura/escrita pelo dono, independente do umask.
                                    // Sem isto, arquivos baixados podem ter 0o600 e bloquear abertura posterior.
                                    #[cfg(unix)]
                                    {
                                        use std::os::unix::fs::PermissionsExt;
                                        let _ = std::fs::set_permissions(
                                            &local_path,
                                            std::fs::Permissions::from_mode(0o644),
                                        );
                                    }
                                    let local_hash = compute_hash(&content);
                                    manifest.update_entry(
                                        &change.path,
                                        SyncFileEntry {
                                            local_hash: local_hash.clone(),
                                            remote_hash: rf.hash.clone(),
                                            local_modified_at: chrono::Utc::now(),
                                            remote_modified_at: rf.modified_at,
                                            synced_at: chrono::Utc::now(),
                                        },
                                    );
                                    downloaded += 1;
                                }
                                Err(e) => errors.push(format!("Write {}: {}", change.path, e)),
                            }
                        }
                        Err(e) => errors.push(format!("Download {}: {}", change.path, e)),
                    }
                }
            }

            // Conflict: save remote copy alongside local
            FileChangeKind::BothModified => {
                if let Some(rf) = remote_by_path.get(&change.path) {
                    if let Ok(remote_content) = provider.download_remote_file(&token, rf).await {
                        let conflict_path = {
                            let p = std::path::Path::new(&change.path);
                            let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
                            let ext = p.extension().and_then(|s| s.to_str()).unwrap_or("");
                            let parent = p
                                .parent()
                                .map(|p| p.to_string_lossy().to_string())
                                .unwrap_or_default();
                            if parent.is_empty() {
                                format!("{}.conflict.{}", stem, ext)
                            } else {
                                format!("{}/{}.conflict.{}", parent, stem, ext)
                            }
                        };
                        let conflict_local = workspace_root.join(&conflict_path);
                        if let Some(parent) = conflict_local.parent() {
                            let _ = std::fs::create_dir_all(parent);
                        }
                        let _ = std::fs::write(&conflict_local, &remote_content);
                    }
                }
                conflicts += 1;
            }

            // Local deleted: for now keep remote (don't propagate deletion)
            FileChangeKind::LocalDeleted => {}

            FileChangeKind::RemoteDeleted | FileChangeKind::Unchanged => {}
        }
    }

    // ── Save manifest ────────────────────────────────────────────────────────
    let _ = manifest.save(&manifest_path);

    // ── Update sync status in coordinator ───────────────────────────────────
    if let Ok(Some(id)) = state.get_focused_id() {
        let _ = state.with_workspace_mut(&id, |ctx| {
            if let Some(ref mut coord) = ctx.sync_coordinator {
                let status = coord.get_status_mut();
                status.last_synced_at = Some(chrono::Utc::now());
                status.is_syncing = false;
                status.pending_conflicts = conflicts;
            }
            Ok(())
        });
    }

    Ok(SyncBidirectionalResult {
        uploaded,
        downloaded,
        conflicts,
        errors,
    })
}

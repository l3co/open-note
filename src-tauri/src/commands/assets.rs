use tauri::State;

use opennote_core::id::SectionId;
use opennote_storage::engine::FsStorageEngine;

use crate::state::AppManagedState;

#[derive(serde::Serialize)]
pub struct AssetResult {
    pub asset_path: String,
    pub absolute_path: String,
}

#[tauri::command]
pub fn import_asset(
    state: State<AppManagedState>,
    section_id: SectionId,
    file_path: String,
) -> Result<AssetResult, String> {
    let root = state.get_workspace_root().map_err(|e| e.to_string())?;
    let source = std::path::PathBuf::from(&file_path);
    let asset_path =
        FsStorageEngine::import_asset(&root, section_id, &source).map_err(|e| e.to_string())?;
    let absolute_path = root.join(&asset_path).to_string_lossy().to_string();
    Ok(AssetResult {
        asset_path,
        absolute_path,
    })
}

#[tauri::command]
pub fn import_asset_from_bytes(
    state: State<AppManagedState>,
    section_id: SectionId,
    bytes: Vec<u8>,
    extension: String,
) -> Result<AssetResult, String> {
    let root = state.get_workspace_root().map_err(|e| e.to_string())?;
    let asset_path =
        FsStorageEngine::import_asset_from_bytes(&root, section_id, &bytes, &extension)
            .map_err(|e| e.to_string())?;
    let absolute_path = root.join(&asset_path).to_string_lossy().to_string();
    Ok(AssetResult {
        asset_path,
        absolute_path,
    })
}

#[tauri::command]
pub fn read_asset_base64(file_path: String) -> Result<String, String> {
    let path = std::path::Path::new(&file_path);
    let bytes = std::fs::read(path).map_err(|e| format!("Failed to read file: {e}"))?;

    let mime = match path.extension().and_then(|e| e.to_str()) {
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("pdf") => "application/pdf",
        _ => "application/octet-stream",
    };

    use base64::Engine;
    let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{mime};base64,{encoded}"))
}

#[tauri::command]
pub fn delete_asset(state: State<AppManagedState>, asset_path: String) -> Result<(), String> {
    let root = state.get_workspace_root().map_err(|e| e.to_string())?;
    FsStorageEngine::delete_asset(&root, &asset_path).map_err(|e| e.to_string())
}

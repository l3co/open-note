use log::warn;
use tauri::State;

use opennote_core::block::Block;
use opennote_core::id::{PageId, SectionId};
use opennote_core::page::{Page, PageSummary};
use opennote_search::engine::PageIndexData;
use opennote_storage::engine::FsStorageEngine;

use crate::error::CommandError;
use crate::state::AppManagedState;

fn try_index_page(state: &AppManagedState, root: &std::path::Path, page: &Page) {
    if let Err(error) = state.ensure_search_engine() {
        warn!("Search engine is unavailable for page indexing: {}", error);
        return;
    }

    match super::search::resolve_page_context(root, page.section_id) {
        Ok(context) => {
            let data = PageIndexData {
                page: page.clone(),
                notebook_name: context.notebook_name,
                section_name: context.section_name,
                notebook_id: context.notebook_id,
                section_id: context.section_id,
            };

            if let Err(error) = state
                .with_search_engine(|engine| engine.index_page(&data).map_err(CommandError::from))
            {
                warn!("Failed to index page {}: {}", page.id, error);
            }
        }
        Err(error) => {
            warn!("Could not resolve page context for indexing: {}", error);
        }
    }
}

/// Resolve o workspace_id e obtém o root_path, propagando erros.
fn resolve_root(
    state: &AppManagedState,
    workspace_id: Option<String>,
) -> Result<std::path::PathBuf, CommandError> {
    let id = super::resolve_workspace_id(state, workspace_id)?;
    state.get_workspace_root_by_id(&id)
}

#[tauri::command]
pub fn list_pages(
    state: State<AppManagedState>,
    section_id: SectionId,
    workspace_id: Option<String>,
) -> Result<Vec<PageSummary>, CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    FsStorageEngine::list_pages(&root, section_id).map_err(CommandError::from)
}

#[tauri::command]
pub fn load_page(
    state: State<AppManagedState>,
    page_id: PageId,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    FsStorageEngine::load_page(&root, page_id).map_err(CommandError::from)
}

#[tauri::command]
pub fn create_page(
    state: State<AppManagedState>,
    section_id: SectionId,
    title: String,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    let page =
        FsStorageEngine::create_page(&root, section_id, &title).map_err(CommandError::from)?;

    try_index_page(&state, &root, &page);

    Ok(page)
}

#[tauri::command]
pub fn update_page(
    state: State<AppManagedState>,
    page: Page,
    workspace_id: Option<String>,
) -> Result<(), CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    FsStorageEngine::update_page(&root, &page).map_err(CommandError::from)?;

    try_index_page(&state, &root, &page);

    Ok(())
}

#[tauri::command]
pub fn update_page_blocks(
    state: State<AppManagedState>,
    page_id: PageId,
    blocks: Vec<Block>,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    let root = resolve_root(&state, workspace_id)?;

    state.save_coordinator.with_page_lock(page_id, || {
        let mut page = FsStorageEngine::load_page(&root, page_id).map_err(CommandError::from)?;
        page.blocks = blocks;
        page.updated_at = chrono::Utc::now();
        FsStorageEngine::update_page(&root, &page).map_err(CommandError::from)?;

        try_index_page(&state, &root, &page);

        Ok(page)
    })
}

#[tauri::command]
pub fn delete_page(
    state: State<AppManagedState>,
    page_id: PageId,
    workspace_id: Option<String>,
) -> Result<(), CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    FsStorageEngine::delete_page(&root, page_id).map_err(CommandError::from)?;

    if let Err(error) = state.with_search_engine(|engine| {
        engine
            .remove_page(&page_id.to_string())
            .map_err(CommandError::from)
    }) {
        warn!("Failed to remove page {} from index: {}", page_id, error);
    }

    Ok(())
}

#[tauri::command]
pub fn move_page(
    state: State<AppManagedState>,
    page_id: PageId,
    target_section_id: SectionId,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    let page = FsStorageEngine::move_page(&root, page_id, target_section_id)
        .map_err(CommandError::from)?;

    try_index_page(&state, &root, &page);

    Ok(page)
}

#[tauri::command]
pub fn import_pdf(
    state: State<AppManagedState>,
    section_id: SectionId,
    file_path: String,
    workspace_id: Option<String>,
) -> Result<(String, String, u32), CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    let source = std::path::Path::new(&file_path);

    if !source.exists() {
        return Err(CommandError::NotFound("PDF file not found".to_string()));
    }

    let (_nb_dir, section_path) =
        FsStorageEngine::find_section_dir(&root, section_id).map_err(CommandError::from)?;
    let assets_dir = section_path.join("assets");
    std::fs::create_dir_all(&assets_dir)
        .map_err(|error| CommandError::Storage(format!("Failed to create assets dir: {error}")))?;

    let uuid = uuid::Uuid::new_v4();
    let dest_name = format!("{uuid}.pdf");
    let dest_path = assets_dir.join(&dest_name);
    std::fs::copy(source, &dest_path)
        .map_err(|error| CommandError::Storage(format!("Failed to copy PDF: {error}")))?;

    let asset_rel = format!("assets/{dest_name}");
    let absolute_path = dest_path.to_string_lossy().to_string();

    let page_count = count_pdf_pages(&dest_path).unwrap_or(0);

    Ok((asset_rel, absolute_path, page_count))
}

fn count_pdf_pages(path: &std::path::Path) -> Option<u32> {
    let document = lopdf::Document::load(path).ok()?;
    Some(document.get_pages().len() as u32)
}

#[tauri::command]
pub fn read_file_content(path: String) -> Result<String, CommandError> {
    std::fs::read_to_string(&path)
        .map_err(|error| CommandError::Storage(format!("Failed to read file: {error}")))
}

#[tauri::command]
pub fn save_file_content(path: String, content: String) -> Result<(), CommandError> {
    std::fs::write(&path, &content)
        .map_err(|error| CommandError::Storage(format!("Failed to write file: {error}")))
}

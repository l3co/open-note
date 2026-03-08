use tauri::State;

use opennote_core::block::Block;
use opennote_core::id::{PageId, SectionId};
use opennote_core::page::{Page, PageSummary};
use opennote_storage::engine::FsStorageEngine;

use crate::state::AppManagedState;

#[tauri::command]
pub fn list_pages(
    state: State<AppManagedState>,
    section_id: SectionId,
) -> Result<Vec<PageSummary>, String> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::list_pages(&root, section_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_page(state: State<AppManagedState>, page_id: PageId) -> Result<Page, String> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::load_page(&root, page_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_page(
    state: State<AppManagedState>,
    section_id: SectionId,
    title: String,
) -> Result<Page, String> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::create_page(&root, section_id, &title).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_page(state: State<AppManagedState>, page: Page) -> Result<(), String> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::update_page(&root, &page).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_page_blocks(
    state: State<AppManagedState>,
    page_id: PageId,
    blocks: Vec<Block>,
) -> Result<Page, String> {
    let root = state.get_workspace_root()?;
    state.save_coordinator.with_page_lock(page_id, || {
        let mut page = FsStorageEngine::load_page(&root, page_id).map_err(|e| e.to_string())?;
        page.blocks = blocks.clone();
        page.updated_at = chrono::Utc::now();
        FsStorageEngine::update_page(&root, &page).map_err(|e| e.to_string())?;
        Ok(page)
    })
}

#[tauri::command]
pub fn delete_page(state: State<AppManagedState>, page_id: PageId) -> Result<(), String> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::delete_page(&root, page_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn move_page(
    state: State<AppManagedState>,
    page_id: PageId,
    target_section_id: SectionId,
) -> Result<Page, String> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::move_page(&root, page_id, target_section_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_pdf(
    state: State<AppManagedState>,
    section_id: SectionId,
    file_path: String,
) -> Result<(String, u32), String> {
    let root = state.get_workspace_root()?;
    let source = std::path::Path::new(&file_path);
    if !source.exists() {
        return Err("PDF file not found".to_string());
    }

    let (_nb_dir, section_path) =
        FsStorageEngine::find_section_dir(&root, section_id).map_err(|e| e.to_string())?;
    let assets_dir = section_path.join("assets");
    std::fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("Failed to create assets dir: {e}"))?;

    let uuid = uuid::Uuid::new_v4();
    let dest_name = format!("{uuid}.pdf");
    let dest_path = assets_dir.join(&dest_name);
    std::fs::copy(source, &dest_path).map_err(|e| format!("Failed to copy PDF: {e}"))?;

    let asset_rel = format!("assets/{dest_name}");

    // Page count: read file and count PDF pages via cross-reference
    let page_count = count_pdf_pages(&dest_path).unwrap_or(0);

    Ok((asset_rel, page_count))
}

fn count_pdf_pages(path: &std::path::Path) -> Option<u32> {
    let content = std::fs::read(path).ok()?;
    let text = String::from_utf8_lossy(&content);
    // Simple heuristic: count /Type /Page entries (not /Pages)
    let count = text.matches("/Type /Page\n").count()
        + text.matches("/Type /Page\r").count()
        + text.matches("/Type /Page ").count()
        + text.matches("/Type/Page\n").count()
        + text.matches("/Type/Page\r").count()
        + text.matches("/Type/Page ").count();
    if count > 0 {
        Some(count as u32)
    } else {
        // Fallback: look for /Count N in the page tree
        text.find("/Count ").and_then(|pos| {
            let rest = &text[pos + 7..];
            let num_str: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
            num_str.parse::<u32>().ok()
        })
    }
}

#[tauri::command]
pub fn read_file_content(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {e}"))
}

#[tauri::command]
pub fn save_file_content(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| format!("Failed to write file: {e}"))
}

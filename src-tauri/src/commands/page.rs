use tauri::State;

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

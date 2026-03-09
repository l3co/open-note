use tauri::State;

use opennote_core::id::PageId;
use opennote_search::engine::{
    IndexStatus, PageIndexData, SearchQuery, SearchResultItem, SearchResults,
};
use opennote_storage::engine::FsStorageEngine;

use crate::state::AppManagedState;

#[tauri::command]
pub fn search_pages(
    state: State<AppManagedState>,
    query: SearchQuery,
) -> Result<SearchResults, String> {
    state.with_search_engine(|engine| engine.search(&query).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn quick_open(
    state: State<AppManagedState>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<SearchResultItem>, String> {
    state.with_search_engine(|engine| {
        engine
            .quick_open(&query, limit.unwrap_or(10))
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn reindex_page(state: State<AppManagedState>, page_id: PageId) -> Result<(), String> {
    let root = state.get_workspace_root()?;
    let page = FsStorageEngine::load_page(&root, page_id).map_err(|e| e.to_string())?;

    let (notebook_name, section_name, notebook_id, section_id) =
        resolve_page_context(&root, page.section_id)?;

    let data = PageIndexData {
        page,
        notebook_name,
        section_name,
        notebook_id,
        section_id,
    };

    state.with_search_engine(|engine| engine.index_page(&data).map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn rebuild_index(state: State<AppManagedState>) -> Result<u64, String> {
    let root = state.get_workspace_root()?;
    let mut all_pages = Vec::new();

    let notebooks = FsStorageEngine::list_notebooks(&root).map_err(|e| e.to_string())?;
    for notebook in &notebooks {
        let sections =
            FsStorageEngine::list_sections(&root, notebook.id).map_err(|e| e.to_string())?;
        for section in &sections {
            let page_summaries =
                FsStorageEngine::list_pages(&root, section.id).map_err(|e| e.to_string())?;
            for summary in &page_summaries {
                let page =
                    FsStorageEngine::load_page(&root, summary.id).map_err(|e| e.to_string())?;
                all_pages.push(PageIndexData {
                    page,
                    notebook_name: notebook.name.clone(),
                    section_name: section.name.clone(),
                    notebook_id: notebook.id.to_string(),
                    section_id: section.id.to_string(),
                });
            }
        }
    }

    let count = all_pages.len() as u64;
    state.with_search_engine(|engine| engine.rebuild(&all_pages).map_err(|e| e.to_string()))?;

    Ok(count)
}

#[tauri::command]
pub fn get_index_status(state: State<AppManagedState>) -> Result<IndexStatus, String> {
    state.with_search_engine(|engine| engine.get_status().map_err(|e| e.to_string()))
}

pub fn resolve_page_context(
    root: &std::path::Path,
    section_id: opennote_core::id::SectionId,
) -> Result<(String, String, String, String), String> {
    let notebooks = FsStorageEngine::list_notebooks(root).map_err(|e| e.to_string())?;
    for notebook in &notebooks {
        let sections =
            FsStorageEngine::list_sections(root, notebook.id).map_err(|e| e.to_string())?;
        for section in &sections {
            if section.id == section_id {
                return Ok((
                    notebook.name.clone(),
                    section.name.clone(),
                    notebook.id.to_string(),
                    section.id.to_string(),
                ));
            }
        }
    }
    Err(format!("Section {section_id} not found in any notebook"))
}

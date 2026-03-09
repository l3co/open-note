use serde::{Deserialize, Serialize};
use tauri::State;

use opennote_core::id::{PageId, SectionId, WorkspaceId};
use opennote_search::engine::{
    IndexStatus, PageIndexData, SearchQuery, SearchResultItem, SearchResults,
};
use opennote_storage::engine::FsStorageEngine;

use crate::error::CommandError;
use crate::state::AppManagedState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossWorkspaceResult {
    pub workspace_id: WorkspaceId,
    pub workspace_name: String,
    #[serde(flatten)]
    pub result: SearchResultItem,
}

#[derive(Debug, Clone)]
pub struct PageContext {
    pub notebook_name: String,
    pub section_name: String,
    pub notebook_id: String,
    pub section_id: String,
}

#[tauri::command]
pub fn search_pages(
    state: State<AppManagedState>,
    query: SearchQuery,
    workspace_id: Option<String>,
) -> Result<SearchResults, CommandError> {
    let id = super::resolve_workspace_id(&state, workspace_id)?;
    state.with_workspace_mut(&id, |ctx| {
        if ctx.search_engine.is_none() {
            ctx.init_search()?;
        }
        Ok(())
    })?;
    state.with_search_engine_for(&id, |engine| {
        engine.search(&query).map_err(CommandError::from)
    })
}

#[tauri::command]
pub fn quick_open(
    state: State<AppManagedState>,
    query: String,
    limit: Option<usize>,
    workspace_id: Option<String>,
) -> Result<Vec<SearchResultItem>, CommandError> {
    let id = super::resolve_workspace_id(&state, workspace_id)?;
    state.with_workspace_mut(&id, |ctx| {
        if ctx.search_engine.is_none() {
            ctx.init_search()?;
        }
        Ok(())
    })?;
    state.with_search_engine_for(&id, |engine| {
        engine
            .quick_open(&query, limit.unwrap_or(10))
            .map_err(CommandError::from)
    })
}

#[tauri::command]
pub fn reindex_page(
    state: State<AppManagedState>,
    page_id: PageId,
    workspace_id: Option<String>,
) -> Result<(), CommandError> {
    let id = super::resolve_workspace_id(&state, workspace_id)?;
    state.with_workspace_mut(&id, |ctx| {
        if ctx.search_engine.is_none() {
            ctx.init_search()?;
        }
        Ok(())
    })?;
    let root = state.get_workspace_root_by_id(&id)?;
    let page = FsStorageEngine::load_page(&root, page_id).map_err(CommandError::from)?;
    let context = resolve_page_context(&root, page.section_id)?;
    let data = PageIndexData {
        page,
        notebook_name: context.notebook_name,
        section_name: context.section_name,
        notebook_id: context.notebook_id,
        section_id: context.section_id,
    };
    state.with_search_engine_for(&id, |engine| {
        engine.index_page(&data).map_err(CommandError::from)
    })
}

#[tauri::command]
pub fn rebuild_index(
    state: State<AppManagedState>,
    workspace_id: Option<String>,
) -> Result<u64, CommandError> {
    let id = super::resolve_workspace_id(&state, workspace_id)?;
    state.with_workspace_mut(&id, |ctx| {
        if ctx.search_engine.is_none() {
            ctx.init_search()?;
        }
        Ok(())
    })?;
    let root = state.get_workspace_root_by_id(&id)?;
    let mut all_pages = Vec::new();

    let notebooks = FsStorageEngine::list_notebooks(&root).map_err(CommandError::from)?;
    for notebook in &notebooks {
        let sections =
            FsStorageEngine::list_sections(&root, notebook.id).map_err(CommandError::from)?;
        for section in &sections {
            let page_summaries =
                FsStorageEngine::list_pages(&root, section.id).map_err(CommandError::from)?;
            for summary in &page_summaries {
                let page =
                    FsStorageEngine::load_page(&root, summary.id).map_err(CommandError::from)?;
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
    state.with_search_engine_for(&id, |engine| {
        engine.rebuild(&all_pages).map_err(CommandError::from)
    })?;
    Ok(count)
}

#[tauri::command]
pub fn get_index_status(
    state: State<AppManagedState>,
    workspace_id: Option<String>,
) -> Result<IndexStatus, CommandError> {
    let id = super::resolve_workspace_id(&state, workspace_id)?;
    state.with_workspace_mut(&id, |ctx| {
        if ctx.search_engine.is_none() {
            ctx.init_search()?;
        }
        Ok(())
    })?;
    state.with_search_engine_for(&id, |engine| {
        engine.get_status().map_err(CommandError::from)
    })
}

#[tauri::command]
pub fn search_all_workspaces(
    state: State<AppManagedState>,
    query: SearchQuery,
) -> Result<Vec<CrossWorkspaceResult>, CommandError> {
    let workspaces = state.list_open_workspaces()?;
    let mut all_results: Vec<CrossWorkspaceResult> = Vec::new();
    let limit = query.limit;

    for (ws_id, ws_name) in &workspaces {
        // Lazy-init search engine if needed
        let _ = state.with_workspace_mut(ws_id, |ctx| {
            if ctx.search_engine.is_none() {
                ctx.init_search()?;
            }
            Ok(())
        });

        if let Ok(results) = state.with_search_engine_for(ws_id, |engine| {
            engine.search(&query).map_err(CommandError::from)
        }) {
            for item in results.items {
                all_results.push(CrossWorkspaceResult {
                    workspace_id: *ws_id,
                    workspace_name: ws_name.clone(),
                    result: item,
                });
            }
        }
    }

    all_results.sort_by(|a, b| {
        b.result
            .score
            .partial_cmp(&a.result.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    all_results.truncate(limit);

    Ok(all_results)
}

pub fn resolve_page_context(
    root: &std::path::Path,
    section_id: SectionId,
) -> Result<PageContext, CommandError> {
    let notebooks = FsStorageEngine::list_notebooks(root).map_err(CommandError::from)?;

    for notebook in &notebooks {
        let sections =
            FsStorageEngine::list_sections(root, notebook.id).map_err(CommandError::from)?;
        for section in &sections {
            if section.id == section_id {
                return Ok(PageContext {
                    notebook_name: notebook.name.clone(),
                    section_name: section.name.clone(),
                    notebook_id: notebook.id.to_string(),
                    section_id: section.id.to_string(),
                });
            }
        }
    }

    Err(CommandError::NotFound(format!(
        "Section {section_id} not found in any notebook"
    )))
}

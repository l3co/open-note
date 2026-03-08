use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use opennote_core::id::PageId;
use opennote_search::engine::SearchEngine;
use opennote_sync::coordinator::SyncCoordinator;

pub struct AppManagedState {
    pub workspace_root: Mutex<Option<PathBuf>>,
    pub save_coordinator: SaveCoordinator,
    pub search_engine: Mutex<Option<SearchEngine>>,
    pub sync_coordinator: Mutex<Option<SyncCoordinator>>,
}

impl AppManagedState {
    pub fn new() -> Self {
        Self {
            workspace_root: Mutex::new(None),
            save_coordinator: SaveCoordinator::new(),
            search_engine: Mutex::new(None),
            sync_coordinator: Mutex::new(None),
        }
    }

    pub fn get_workspace_root(&self) -> Result<PathBuf, String> {
        self.workspace_root
            .lock()
            .map_err(|e| format!("Lock error: {e}"))?
            .clone()
            .ok_or_else(|| "No workspace is currently open".to_string())
    }

    pub fn set_workspace_root(&self, path: Option<PathBuf>) -> Result<(), String> {
        let mut root = self
            .workspace_root
            .lock()
            .map_err(|e| format!("Lock error: {e}"))?;
        *root = path;
        Ok(())
    }

    pub fn init_sync_coordinator(&self, workspace_root: &std::path::Path) -> Result<(), String> {
        let coordinator = SyncCoordinator::new(workspace_root.to_path_buf());
        let mut guard = self
            .sync_coordinator
            .lock()
            .map_err(|e| format!("Lock error: {e}"))?;
        *guard = Some(coordinator);
        Ok(())
    }

    pub fn init_search_engine(&self, workspace_root: &std::path::Path) -> Result<(), String> {
        let index_dir = workspace_root.join(".opennote").join("index");
        let engine = SearchEngine::open_or_create(&index_dir)
            .map_err(|e| format!("Failed to init search engine: {e}"))?;
        let mut guard = self
            .search_engine
            .lock()
            .map_err(|e| format!("Lock error: {e}"))?;
        *guard = Some(engine);
        Ok(())
    }

    pub fn with_search_engine<F, R>(&self, f: F) -> Result<R, String>
    where
        F: FnOnce(&SearchEngine) -> Result<R, String>,
    {
        let guard = self
            .search_engine
            .lock()
            .map_err(|e| format!("Lock error: {e}"))?;
        let engine = guard
            .as_ref()
            .ok_or_else(|| "Search engine not initialized".to_string())?;
        f(engine)
    }
}

pub struct SaveCoordinator {
    locks: Mutex<HashMap<PageId, ()>>,
}

impl SaveCoordinator {
    pub fn new() -> Self {
        Self {
            locks: Mutex::new(HashMap::new()),
        }
    }

    pub fn with_page_lock<F, R>(&self, page_id: PageId, f: F) -> Result<R, String>
    where
        F: FnOnce() -> Result<R, String>,
    {
        {
            let mut map = self.locks.lock().map_err(|e| format!("Lock error: {e}"))?;
            map.entry(page_id).or_insert(());
        }
        let result = f();
        {
            let mut map = self.locks.lock().map_err(|e| format!("Lock error: {e}"))?;
            map.remove(&page_id);
        }
        result
    }
}

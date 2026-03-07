use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use opennote_core::id::PageId;

pub struct AppManagedState {
    pub workspace_root: Mutex<Option<PathBuf>>,
    pub save_coordinator: SaveCoordinator,
}

impl AppManagedState {
    pub fn new() -> Self {
        Self {
            workspace_root: Mutex::new(None),
            save_coordinator: SaveCoordinator::new(),
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

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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    // ─── Phase 5 Retrofit: State Integrity ───

    #[test]
    fn test_managed_state_no_workspace_returns_graceful_error() {
        let state = AppManagedState::new();

        let result = state.get_workspace_root();
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(
            msg.contains("No workspace"),
            "Should mention 'No workspace', got: {msg}"
        );
    }

    #[test]
    fn test_managed_state_set_and_get_workspace_root() {
        let state = AppManagedState::new();

        state
            .set_workspace_root(Some(PathBuf::from("/tmp/ws")))
            .unwrap();
        let root = state.get_workspace_root().unwrap();
        assert_eq!(root, PathBuf::from("/tmp/ws"));

        state.set_workspace_root(None).unwrap();
        assert!(state.get_workspace_root().is_err());
    }

    #[test]
    fn test_search_engine_not_initialized_returns_error() {
        let state = AppManagedState::new();

        let result = state.with_search_engine(|_engine| Ok(()));
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(
            msg.contains("not initialized"),
            "Should mention 'not initialized', got: {msg}"
        );
    }

    // ─── Phase 5 Retrofit: SaveCoordinator Thread Safety ───

    #[test]
    fn test_save_coordinator_concurrent_page_writes() {
        let coordinator = Arc::new(SaveCoordinator::new());
        let page_id = PageId::new();

        let mut handles = vec![];
        for i in 0..10 {
            let coord = Arc::clone(&coordinator);
            let pid = page_id;
            handles.push(std::thread::spawn(move || {
                coord.with_page_lock(pid, || {
                    std::thread::sleep(std::time::Duration::from_millis(1));
                    Ok(i)
                })
            }));
        }

        let mut results = vec![];
        for h in handles {
            let r = h.join().unwrap();
            assert!(r.is_ok());
            results.push(r.unwrap());
        }

        assert_eq!(results.len(), 10);
    }

    #[test]
    fn test_save_coordinator_lock_cleanup_on_error() {
        let coordinator = SaveCoordinator::new();
        let page_id = PageId::new();

        let result: Result<(), String> =
            coordinator.with_page_lock(page_id, || Err("Simulated failure".to_string()));
        assert!(result.is_err());

        // Lock should be cleaned up — next call should succeed
        let result = coordinator.with_page_lock(page_id, || Ok(42));
        assert_eq!(result.unwrap(), 42);
    }

    #[test]
    fn test_save_coordinator_different_pages_no_interference() {
        let coordinator = Arc::new(SaveCoordinator::new());
        let page_a = PageId::new();
        let page_b = PageId::new();

        let coord_a = Arc::clone(&coordinator);
        let coord_b = Arc::clone(&coordinator);

        let handle_a = std::thread::spawn(move || {
            coord_a.with_page_lock(page_a, || {
                std::thread::sleep(std::time::Duration::from_millis(5));
                Ok("a")
            })
        });

        let handle_b = std::thread::spawn(move || {
            coord_b.with_page_lock(page_b, || {
                std::thread::sleep(std::time::Duration::from_millis(5));
                Ok("b")
            })
        });

        assert_eq!(handle_a.join().unwrap().unwrap(), "a");
        assert_eq!(handle_b.join().unwrap().unwrap(), "b");
    }

    // ─── Phase 5 Retrofit: Error String Readability ───

    #[test]
    fn test_error_strings_are_human_readable() {
        // Validation errors from core should be readable strings
        let err = opennote_core::error::CoreError::Validation {
            message: "Notebook name cannot be empty".to_string(),
        };
        let msg = err.to_string();
        assert!(msg.contains("Validation"));
        assert!(msg.contains("cannot be empty"));

        // Storage errors should be readable
        let err = opennote_storage::error::StorageError::WorkspaceNotFound {
            path: PathBuf::from("/nonexistent"),
        };
        let msg = err.to_string();
        assert!(msg.contains("Workspace"));
        assert!(msg.contains("/nonexistent"));

        // NotFound errors should be readable
        let err = opennote_core::error::CoreError::NotFound {
            entity: "Page".to_string(),
            id: "abc-123".to_string(),
        };
        let msg = err.to_string();
        assert!(msg.contains("Page"));
        assert!(msg.contains("abc-123"));
    }
}

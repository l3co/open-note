use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use opennote_core::id::PageId;
use opennote_search::engine::SearchEngine;
use opennote_sync::coordinator::SyncCoordinator;

use crate::error::CommandError;

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

    pub fn get_workspace_root(&self) -> Result<PathBuf, CommandError> {
        self.workspace_root
            .lock()
            .map_err(|_| CommandError::Internal("State lock poisoned".to_string()))?
            .clone()
            .ok_or(CommandError::NoWorkspace)
    }

    pub fn set_workspace_root(&self, path: Option<PathBuf>) -> Result<(), CommandError> {
        let mut root = self
            .workspace_root
            .lock()
            .map_err(|_| CommandError::Internal("State lock poisoned".to_string()))?;
        *root = path;
        Ok(())
    }

    pub fn init_sync_coordinator(
        &self,
        workspace_root: &std::path::Path,
    ) -> Result<(), CommandError> {
        let coordinator = SyncCoordinator::new(workspace_root.to_path_buf());
        let mut guard = self
            .sync_coordinator
            .lock()
            .map_err(|_| CommandError::Internal("State lock poisoned".to_string()))?;
        *guard = Some(coordinator);
        Ok(())
    }

    pub fn init_search_engine(&self, workspace_root: &std::path::Path) -> Result<(), CommandError> {
        let index_dir = workspace_root.join(".opennote").join("index");
        let engine = match SearchEngine::open_or_create(&index_dir) {
            Ok(engine) => engine,
            Err(first_error) => {
                if index_dir.exists() {
                    std::fs::remove_dir_all(&index_dir).map_err(|error| {
                        CommandError::Internal(format!(
                            "Failed to reset search index at {} after init error ({first_error}): {error}",
                            index_dir.display()
                        ))
                    })?;
                }

                SearchEngine::open_or_create(&index_dir).map_err(|second_error| {
                    CommandError::Internal(format!(
                        "Failed to initialize search engine at {} (first attempt: {first_error}; retry: {second_error})",
                        index_dir.display()
                    ))
                })?
            }
        };

        let mut guard = self
            .search_engine
            .lock()
            .map_err(|_| CommandError::Internal("State lock poisoned".to_string()))?;
        *guard = Some(engine);
        Ok(())
    }

    pub fn ensure_search_engine(&self) -> Result<(), CommandError> {
        let should_init = {
            let guard = self
                .search_engine
                .lock()
                .map_err(|_| CommandError::Internal("State lock poisoned".to_string()))?;
            guard.is_none()
        };

        if should_init {
            let workspace_root = self.get_workspace_root()?;
            self.init_search_engine(&workspace_root)?;
        }

        Ok(())
    }

    pub fn with_search_engine<F, R>(&self, f: F) -> Result<R, CommandError>
    where
        F: FnOnce(&SearchEngine) -> Result<R, CommandError>,
    {
        let guard = self
            .search_engine
            .lock()
            .map_err(|_| CommandError::Internal("State lock poisoned".to_string()))?;
        let engine = guard
            .as_ref()
            .ok_or_else(|| CommandError::Internal("Search engine not initialized".to_string()))?;

        f(engine)
    }
}

pub struct SaveCoordinator {
    page_locks: Mutex<HashMap<PageId, Arc<Mutex<()>>>>,
}

impl SaveCoordinator {
    pub fn new() -> Self {
        Self {
            page_locks: Mutex::new(HashMap::new()),
        }
    }

    pub fn with_page_lock<F, R>(&self, page_id: PageId, f: F) -> Result<R, CommandError>
    where
        F: FnOnce() -> Result<R, CommandError>,
    {
        let page_lock = {
            let mut locks = self
                .page_locks
                .lock()
                .map_err(|_| CommandError::Internal("State lock poisoned".to_string()))?;

            locks
                .entry(page_id)
                .or_insert_with(|| Arc::new(Mutex::new(())))
                .clone()
        };

        let _guard = page_lock
            .lock()
            .map_err(|_| CommandError::Internal(format!("Page lock poisoned for {page_id}")))?;

        f()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn managed_state_without_workspace_returns_no_workspace() {
        let state = AppManagedState::new();

        let result = state.get_workspace_root();

        assert!(matches!(result, Err(CommandError::NoWorkspace)));
    }

    #[test]
    fn managed_state_sets_and_gets_workspace_root() {
        let state = AppManagedState::new();

        state
            .set_workspace_root(Some(PathBuf::from("/tmp/ws")))
            .expect("workspace should be set");
        let root = state
            .get_workspace_root()
            .expect("workspace should be present");
        assert_eq!(root, PathBuf::from("/tmp/ws"));

        state
            .set_workspace_root(None)
            .expect("workspace should clear");
        assert!(matches!(
            state.get_workspace_root(),
            Err(CommandError::NoWorkspace)
        ));
    }

    #[test]
    fn search_engine_not_initialized_returns_internal_error() {
        let state = AppManagedState::new();

        let result = state.with_search_engine(|_engine| Ok(()));

        assert!(matches!(result, Err(CommandError::Internal(_))));
    }

    #[test]
    fn save_coordinator_serializes_concurrent_writes_same_page() {
        let coordinator = Arc::new(SaveCoordinator::new());
        let page_id = PageId::new();
        let in_critical = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let max_seen = Arc::new(std::sync::atomic::AtomicUsize::new(0));

        let mut handles = Vec::new();

        for _ in 0..10 {
            let coordinator = Arc::clone(&coordinator);
            let in_critical = Arc::clone(&in_critical);
            let max_seen = Arc::clone(&max_seen);

            handles.push(std::thread::spawn(move || {
                coordinator.with_page_lock(page_id, || {
                    use std::sync::atomic::Ordering;
                    let current = in_critical.fetch_add(1, Ordering::SeqCst) + 1;

                    loop {
                        let previous = max_seen.load(Ordering::SeqCst);
                        if current <= previous {
                            break;
                        }
                        if max_seen
                            .compare_exchange(previous, current, Ordering::SeqCst, Ordering::SeqCst)
                            .is_ok()
                        {
                            break;
                        }
                    }

                    std::thread::sleep(std::time::Duration::from_millis(1));
                    in_critical.fetch_sub(1, Ordering::SeqCst);

                    Ok(())
                })
            }));
        }

        for handle in handles {
            handle
                .join()
                .expect("thread join should succeed")
                .expect("critical section should succeed");
        }

        assert_eq!(
            max_seen.load(std::sync::atomic::Ordering::SeqCst),
            1,
            "same-page operations must never overlap"
        );
    }

    #[test]
    fn save_coordinator_allows_parallel_writes_different_pages() {
        let coordinator = Arc::new(SaveCoordinator::new());
        let page_a = PageId::new();
        let page_b = PageId::new();

        let started_a = Arc::new(std::sync::Barrier::new(2));
        let started_b = Arc::clone(&started_a);

        let coord_a = Arc::clone(&coordinator);
        let coord_b = Arc::clone(&coordinator);

        let handle_a = std::thread::spawn(move || {
            coord_a.with_page_lock(page_a, || {
                started_a.wait();
                std::thread::sleep(std::time::Duration::from_millis(5));
                Ok("a")
            })
        });

        let handle_b = std::thread::spawn(move || {
            coord_b.with_page_lock(page_b, || {
                started_b.wait();
                std::thread::sleep(std::time::Duration::from_millis(5));
                Ok("b")
            })
        });

        assert_eq!(
            handle_a
                .join()
                .expect("thread join should succeed")
                .expect("page a should succeed"),
            "a"
        );
        assert_eq!(
            handle_b
                .join()
                .expect("thread join should succeed")
                .expect("page b should succeed"),
            "b"
        );
    }

    #[test]
    fn save_coordinator_recovers_after_failure() {
        let coordinator = SaveCoordinator::new();
        let page_id = PageId::new();

        let result: Result<(), CommandError> = coordinator.with_page_lock(page_id, || {
            Err(CommandError::Internal("simulated failure".to_string()))
        });
        assert!(result.is_err());

        let result = coordinator.with_page_lock(page_id, || Ok(42));
        assert_eq!(result.expect("lock should be reusable"), 42);
    }
}

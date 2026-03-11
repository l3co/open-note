use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use opennote_core::id::{PageId, WorkspaceId};
use opennote_search::engine::SearchEngine;
use opennote_sync::coordinator::SyncCoordinator;

use crate::error::CommandError;

const MAX_OPEN_WORKSPACES: usize = 10;

// ── WorkspaceContext ──────────────────────────────────────────────────────────

/// Contexto isolado de um workspace aberto.
/// Cada workspace tem seu próprio SearchEngine e SyncCoordinator.
pub struct WorkspaceContext {
    pub root_path: PathBuf,
    pub name: String,
    pub search_engine: Option<SearchEngine>,
    pub sync_coordinator: Option<SyncCoordinator>,
    /// Chaves AES-256 derivadas (em memória), com opcional de expiração.
    /// (Key, Expiration)
    pub session_keys: HashMap<PageId, (Vec<u8>, Option<chrono::DateTime<chrono::Utc>>)>,
}

impl WorkspaceContext {
    pub fn new(root_path: PathBuf, name: String) -> Self {
        Self {
            root_path,
            name,
            search_engine: None,
            sync_coordinator: None,
            session_keys: HashMap::new(),
        }
    }

    pub fn init_search(&mut self) -> Result<(), CommandError> {
        let index_dir = self.root_path.join(".opennote").join("index");
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
                        "Failed to initialize search engine at {} (first: {first_error}; retry: {second_error})",
                        index_dir.display()
                    ))
                })?
            }
        };
        self.search_engine = Some(engine);
        Ok(())
    }

    pub fn init_sync(&mut self) -> Result<(), CommandError> {
        self.sync_coordinator = Some(SyncCoordinator::new(self.root_path.clone()));
        Ok(())
    }

    pub fn with_search<F, R>(&self, f: F) -> Result<R, CommandError>
    where
        F: FnOnce(&SearchEngine) -> Result<R, CommandError>,
    {
        let engine = self
            .search_engine
            .as_ref()
            .ok_or_else(|| CommandError::Internal("Search not initialized".to_string()))?;
        f(engine)
    }
}

// ── AppManagedState ───────────────────────────────────────────────────────────

pub struct AppManagedState {
    workspaces: Mutex<HashMap<WorkspaceId, WorkspaceContext>>,
    focused_id: Mutex<Option<WorkspaceId>>,
    pub save_coordinator: SaveCoordinator,
}

impl AppManagedState {
    pub fn new() -> Self {
        Self {
            workspaces: Mutex::new(HashMap::new()),
            focused_id: Mutex::new(None),
            save_coordinator: SaveCoordinator::new(),
        }
    }

    // ── Workspace Lifecycle ───────────────────────────────────────────────

    /// Registra um novo workspace aberto. Retorna erro se o limite for atingido.
    pub fn register_workspace(
        &self,
        id: WorkspaceId,
        context: WorkspaceContext,
    ) -> Result<(), CommandError> {
        let mut map = self
            .workspaces
            .lock()
            .map_err(|_| CommandError::Internal("State lock poisoned".to_string()))?;

        if map.len() >= MAX_OPEN_WORKSPACES && !map.contains_key(&id) {
            return Err(CommandError::Validation(format!(
                "Maximum of {MAX_OPEN_WORKSPACES} simultaneous workspaces reached"
            )));
        }

        map.insert(id, context);
        Ok(())
    }

    /// Remove um workspace do registro.
    pub fn unregister_workspace(&self, id: &WorkspaceId) -> Result<(), CommandError> {
        let mut map = self
            .workspaces
            .lock()
            .map_err(|_| CommandError::Internal("State lock poisoned".to_string()))?;
        map.remove(id);

        let mut focused = self
            .focused_id
            .lock()
            .map_err(|_| CommandError::Internal("State lock poisoned".to_string()))?;
        if focused.as_ref() == Some(id) {
            *focused = map.keys().next().copied();
        }
        Ok(())
    }

    /// Define qual workspace está em foco.
    pub fn set_focused(&self, id: Option<WorkspaceId>) -> Result<(), CommandError> {
        let mut focused = self
            .focused_id
            .lock()
            .map_err(|_| CommandError::Internal("State lock poisoned".to_string()))?;
        *focused = id;
        Ok(())
    }

    /// Guarda a chave derivada para a page na sessão do workspace atual com TTL opcional.
    pub fn cache_key(
        &self,
        page_id: PageId,
        key: Vec<u8>,
        expires_at: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<(), CommandError> {
        let id = self.get_focused_id()?.ok_or(CommandError::NoWorkspace)?;
        self.with_workspace_mut(&id, |ctx| {
            ctx.session_keys.insert(page_id, (key, expires_at));
            Ok(())
        })
    }

    /// Retorna a chave em cache para a page (se desbloqueada e não expirada).
    pub fn get_cached_key(&self, page_id: PageId) -> Result<Option<Vec<u8>>, CommandError> {
        let id = self.get_focused_id()?.ok_or(CommandError::NoWorkspace)?;
        self.with_workspace_mut(&id, |ctx| {
            let mut expired = false;
            let key = if let Some((key, expiration)) = ctx.session_keys.get(&page_id) {
                if let Some(exp) = expiration {
                    if *exp < chrono::Utc::now() {
                        expired = true;
                        None
                    } else {
                        Some(key.clone())
                    }
                } else {
                    Some(key.clone())
                }
            } else {
                None
            };

            if expired {
                ctx.session_keys.remove(&page_id);
            }

            Ok(key)
        })
    }

    /// Remove a chave da sessão (re-lock manual).
    pub fn evict_key(&self, page_id: PageId) -> Result<(), CommandError> {
        let id = self.get_focused_id()?.ok_or(CommandError::NoWorkspace)?;
        self.with_workspace_mut(&id, |ctx| {
            ctx.session_keys.remove(&page_id);
            Ok(())
        })
    }

    /// Retorna o ID do workspace em foco.
    pub fn get_focused_id(&self) -> Result<Option<WorkspaceId>, CommandError> {
        self.focused_id
            .lock()
            .map(|g| *g)
            .map_err(|_| CommandError::Internal("State lock poisoned".to_string()))
    }

    // ── Workspace Access ─────────────────────────────────────────────────

    #[allow(dead_code)]
    /// Retorna root_path do workspace em foco (backward compat).
    pub fn get_workspace_root(&self) -> Result<PathBuf, CommandError> {
        let id = self.get_focused_id()?.ok_or(CommandError::NoWorkspace)?;
        self.get_workspace_root_by_id(&id)
    }

    /// Retorna root_path de um workspace específico por ID.
    pub fn get_workspace_root_by_id(&self, id: &WorkspaceId) -> Result<PathBuf, CommandError> {
        let map = self
            .workspaces
            .lock()
            .map_err(|_| CommandError::Internal("State lock poisoned".to_string()))?;
        map.get(id)
            .map(|ctx| ctx.root_path.clone())
            .ok_or_else(|| CommandError::WorkspaceNotFound(id.to_string()))
    }

    /// Executa closure com acesso imutável ao WorkspaceContext.
    pub fn with_workspace<F, R>(&self, id: &WorkspaceId, f: F) -> Result<R, CommandError>
    where
        F: FnOnce(&WorkspaceContext) -> Result<R, CommandError>,
    {
        let map = self
            .workspaces
            .lock()
            .map_err(|_| CommandError::Internal("State lock poisoned".to_string()))?;
        let ctx = map
            .get(id)
            .ok_or_else(|| CommandError::WorkspaceNotFound(id.to_string()))?;
        f(ctx)
    }

    /// Executa closure com acesso mutável ao WorkspaceContext.
    pub fn with_workspace_mut<F, R>(&self, id: &WorkspaceId, f: F) -> Result<R, CommandError>
    where
        F: FnOnce(&mut WorkspaceContext) -> Result<R, CommandError>,
    {
        let mut map = self
            .workspaces
            .lock()
            .map_err(|_| CommandError::Internal("State lock poisoned".to_string()))?;
        let ctx = map
            .get_mut(id)
            .ok_or_else(|| CommandError::WorkspaceNotFound(id.to_string()))?;
        f(ctx)
    }

    // ── Search Engine ─────────────────────────────────────────────────────

    /// Acessa o search engine do workspace em foco (backward compat).
    pub fn with_search_engine<F, R>(&self, f: F) -> Result<R, CommandError>
    where
        F: FnOnce(&SearchEngine) -> Result<R, CommandError>,
    {
        let id = self.get_focused_id()?.ok_or(CommandError::NoWorkspace)?;
        self.with_search_engine_for(&id, f)
    }

    /// Acessa o search engine de um workspace específico.
    pub fn with_search_engine_for<F, R>(
        &self,
        workspace_id: &WorkspaceId,
        f: F,
    ) -> Result<R, CommandError>
    where
        F: FnOnce(&SearchEngine) -> Result<R, CommandError>,
    {
        let map = self
            .workspaces
            .lock()
            .map_err(|_| CommandError::Internal("State lock poisoned".to_string()))?;
        let ctx = map
            .get(workspace_id)
            .ok_or_else(|| CommandError::WorkspaceNotFound(workspace_id.to_string()))?;
        ctx.with_search(f)
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    #[allow(dead_code)]
    /// Resolve WorkspaceId: se Some usa direto, se None usa focused.
    pub fn resolve_workspace_id(
        &self,
        workspace_id: Option<WorkspaceId>,
    ) -> Result<WorkspaceId, CommandError> {
        match workspace_id {
            Some(id) => Ok(id),
            None => self.get_focused_id()?.ok_or(CommandError::NoWorkspace),
        }
    }

    /// Lista todos os workspaces abertos: (WorkspaceId, name).
    pub fn list_open_workspaces(&self) -> Result<Vec<(WorkspaceId, String)>, CommandError> {
        let map = self
            .workspaces
            .lock()
            .map_err(|_| CommandError::Internal("State lock poisoned".to_string()))?;
        Ok(map
            .iter()
            .map(|(id, ctx)| (*id, ctx.name.clone()))
            .collect())
    }

    // ── Backward-compat wrappers (deprecated) ────────────────────────────

    #[allow(dead_code)]
    /// DEPRECATED: Use `register_workspace`.
    /// Mantido para compatibilidade durante migração dos commands.
    pub fn set_workspace_root(&self, path: Option<PathBuf>) -> Result<(), CommandError> {
        match path {
            None => {
                if let Some(id) = self.get_focused_id()? {
                    self.unregister_workspace(&id)?;
                }
                self.set_focused(None)?;
            }
            Some(p) => {
                let name = p
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "Workspace".to_string());
                let ctx = WorkspaceContext::new(p, name);
                let id = WorkspaceId::new();
                self.register_workspace(id, ctx)?;
                self.set_focused(Some(id))?;
            }
        }
        Ok(())
    }

    #[allow(dead_code)]
    /// DEPRECATED: Use `with_workspace_mut` + `init_search`.
    pub fn init_search_engine(&self, workspace_root: &Path) -> Result<(), CommandError> {
        let map = self
            .workspaces
            .lock()
            .map_err(|_| CommandError::Internal("State lock poisoned".to_string()))?;
        let id = map
            .iter()
            .find(|(_, ctx)| ctx.root_path == workspace_root)
            .map(|(id, _)| *id);
        drop(map);

        if let Some(id) = id {
            self.with_workspace_mut(&id, |ctx| ctx.init_search())
        } else {
            Err(CommandError::Internal(format!(
                "No workspace registered at {}",
                workspace_root.display()
            )))
        }
    }

    #[allow(dead_code)]
    /// DEPRECATED: Use `with_workspace_mut` + `init_sync`.
    pub fn init_sync_coordinator(&self, workspace_root: &Path) -> Result<(), CommandError> {
        let map = self
            .workspaces
            .lock()
            .map_err(|_| CommandError::Internal("State lock poisoned".to_string()))?;
        let id = map
            .iter()
            .find(|(_, ctx)| ctx.root_path == workspace_root)
            .map(|(id, _)| *id);
        drop(map);

        if let Some(id) = id {
            self.with_workspace_mut(&id, |ctx| ctx.init_sync())
        } else {
            Err(CommandError::Internal(format!(
                "No workspace registered at {}",
                workspace_root.display()
            )))
        }
    }

    #[allow(dead_code)]
    /// DEPRECATED: Use `with_search_engine`.
    pub fn ensure_search_engine(&self) -> Result<(), CommandError> {
        let id = self.get_focused_id()?.ok_or(CommandError::NoWorkspace)?;
        let needs_init = self.with_workspace(&id, |ctx| Ok(ctx.search_engine.is_none()))?;
        if needs_init {
            self.with_workspace_mut(&id, |ctx| ctx.init_search())?;
        }
        Ok(())
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

    fn make_ctx(path: &str) -> WorkspaceContext {
        WorkspaceContext::new(PathBuf::from(path), path.to_string())
    }

    // ── Backward-compat tests ─────────────────────────────────────────────

    #[test]
    fn managed_state_without_workspace_returns_no_workspace() {
        let state = AppManagedState::new();
        assert!(matches!(
            state.get_workspace_root(),
            Err(CommandError::NoWorkspace)
        ));
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
    fn search_engine_without_workspace_returns_no_workspace() {
        let state = AppManagedState::new();
        let result = state.with_search_engine(|_| Ok(()));
        assert!(matches!(result, Err(CommandError::NoWorkspace)));
    }

    // ── Multi-workspace tests ─────────────────────────────────────────────

    #[test]
    fn register_and_unregister_workspace() {
        let state = AppManagedState::new();
        let id = WorkspaceId::new();
        state.register_workspace(id, make_ctx("/tmp/ws")).unwrap();
        state.set_focused(Some(id)).unwrap();

        let root = state.get_workspace_root_by_id(&id).unwrap();
        assert_eq!(root, PathBuf::from("/tmp/ws"));

        state.unregister_workspace(&id).unwrap();
        assert!(matches!(
            state.get_workspace_root_by_id(&id),
            Err(CommandError::WorkspaceNotFound(_))
        ));
    }

    #[test]
    fn focused_workspace_returns_correct_root() {
        let state = AppManagedState::new();
        let id_a = WorkspaceId::new();
        let id_b = WorkspaceId::new();
        state
            .register_workspace(id_a, make_ctx("/tmp/ws_a"))
            .unwrap();
        state
            .register_workspace(id_b, make_ctx("/tmp/ws_b"))
            .unwrap();

        state.set_focused(Some(id_a)).unwrap();
        assert_eq!(
            state.get_workspace_root().unwrap(),
            PathBuf::from("/tmp/ws_a")
        );

        state.set_focused(Some(id_b)).unwrap();
        assert_eq!(
            state.get_workspace_root().unwrap(),
            PathBuf::from("/tmp/ws_b")
        );
    }

    #[test]
    fn backward_compat_get_workspace_root() {
        let state = AppManagedState::new();
        state
            .set_workspace_root(Some(PathBuf::from("/tmp/ws")))
            .unwrap();
        let root = state.get_workspace_root().unwrap();
        assert_eq!(root, PathBuf::from("/tmp/ws"));
    }

    #[test]
    fn resolve_workspace_id_uses_focused() {
        let state = AppManagedState::new();
        let id = WorkspaceId::new();
        state.register_workspace(id, make_ctx("/tmp/ws")).unwrap();
        state.set_focused(Some(id)).unwrap();

        let resolved = state.resolve_workspace_id(None).unwrap();
        assert_eq!(resolved, id);
    }

    #[test]
    fn resolve_workspace_id_explicit() {
        let state = AppManagedState::new();
        let id_a = WorkspaceId::new();
        let id_b = WorkspaceId::new();
        state
            .register_workspace(id_a, make_ctx("/tmp/ws_a"))
            .unwrap();
        state
            .register_workspace(id_b, make_ctx("/tmp/ws_b"))
            .unwrap();
        state.set_focused(Some(id_a)).unwrap();

        let resolved = state.resolve_workspace_id(Some(id_b)).unwrap();
        assert_eq!(resolved, id_b);
    }

    #[test]
    fn resolve_without_focused_errors() {
        let state = AppManagedState::new();
        assert!(matches!(
            state.resolve_workspace_id(None),
            Err(CommandError::NoWorkspace)
        ));
    }

    #[test]
    fn unregister_focused_clears_focus() {
        let state = AppManagedState::new();
        let id = WorkspaceId::new();
        state.register_workspace(id, make_ctx("/tmp/ws")).unwrap();
        state.set_focused(Some(id)).unwrap();

        state.unregister_workspace(&id).unwrap();

        assert!(state.get_focused_id().unwrap().is_none());
    }

    #[test]
    fn multiple_workspaces_coexist() {
        let state = AppManagedState::new();
        let id_a = WorkspaceId::new();
        let id_b = WorkspaceId::new();
        let id_c = WorkspaceId::new();
        state.register_workspace(id_a, make_ctx("/tmp/a")).unwrap();
        state.register_workspace(id_b, make_ctx("/tmp/b")).unwrap();
        state.register_workspace(id_c, make_ctx("/tmp/c")).unwrap();

        assert_eq!(
            state.get_workspace_root_by_id(&id_a).unwrap(),
            PathBuf::from("/tmp/a")
        );
        assert_eq!(
            state.get_workspace_root_by_id(&id_b).unwrap(),
            PathBuf::from("/tmp/b")
        );
        assert_eq!(
            state.get_workspace_root_by_id(&id_c).unwrap(),
            PathBuf::from("/tmp/c")
        );
    }

    #[test]
    fn with_workspace_closure_access() {
        let state = AppManagedState::new();
        let id = WorkspaceId::new();
        state.register_workspace(id, make_ctx("/tmp/ws")).unwrap();

        let path = state
            .with_workspace(&id, |ctx| Ok(ctx.root_path.clone()))
            .unwrap();
        assert_eq!(path, PathBuf::from("/tmp/ws"));
    }

    #[test]
    fn list_open_workspaces() {
        let state = AppManagedState::new();
        let id_a = WorkspaceId::new();
        let id_b = WorkspaceId::new();
        state.register_workspace(id_a, make_ctx("/tmp/a")).unwrap();
        state.register_workspace(id_b, make_ctx("/tmp/b")).unwrap();

        let list = state.list_open_workspaces().unwrap();
        assert_eq!(list.len(), 2);
    }

    #[test]
    fn max_open_workspaces_enforced() {
        let state = AppManagedState::new();
        for i in 0..MAX_OPEN_WORKSPACES {
            let id = WorkspaceId::new();
            state
                .register_workspace(id, make_ctx(&format!("/tmp/ws_{i}")))
                .unwrap();
        }
        let extra_id = WorkspaceId::new();
        let result = state.register_workspace(extra_id, make_ctx("/tmp/extra"));
        assert!(matches!(result, Err(CommandError::Validation(_))));
    }

    #[test]
    fn save_coordinator_works_across_workspaces() {
        let state = AppManagedState::new();
        let page_id = PageId::new();
        let result = state.save_coordinator.with_page_lock(page_id, || Ok(42));
        assert_eq!(result.unwrap(), 42);
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

# Fase 02 — Multi-Workspace State (Tauri Backend)

**Esforço estimado:** ~30 horas  
**Prioridade:** 🔴 Crítica  
**Dependências:** Fase 01  
**Branch:** `feat/multi-workspace-phase-2`

---

## Objetivo

Refatorar `AppManagedState` em `src-tauri/src/state.rs` para manter múltiplos workspaces abertos simultaneamente, cada um com seu próprio `SearchEngine`, `SyncCoordinator` e contexto isolado.

---

## Contexto Atual

```rust
// src-tauri/src/state.rs
pub struct AppManagedState {
    pub workspace_root: Mutex<Option<PathBuf>>,           // SINGULAR
    pub save_coordinator: SaveCoordinator,                 // GLOBAL
    pub search_engine: Mutex<Option<SearchEngine>>,        // SINGULAR
    pub sync_coordinator: Mutex<Option<SyncCoordinator>>,  // SINGULAR
}
```

Todos os IPC commands chamam `state.get_workspace_root()` que retorna UM único path. Ao trocar de workspace, o anterior é fechado (`close_workspace`).

---

## Tarefas

### 2.1 — Criar struct `WorkspaceContext`

**Arquivo:** `src-tauri/src/state.rs`

```rust
/// Contexto isolado de um workspace aberto.
/// Cada workspace tem seu próprio SearchEngine e SyncCoordinator.
pub struct WorkspaceContext {
    pub root_path: PathBuf,
    pub name: String,
    pub search_engine: Option<SearchEngine>,
    pub sync_coordinator: Option<SyncCoordinator>,
}

impl WorkspaceContext {
    pub fn new(root_path: PathBuf, name: String) -> Self {
        Self {
            root_path,
            name,
            search_engine: None,
            sync_coordinator: None,
        }
    }

    pub fn init_search(&mut self) -> Result<(), CommandError> { ... }
    pub fn init_sync(&mut self) -> Result<(), CommandError> { ... }
}
```

**Critérios:**
- [ ] Struct testável independente
- [ ] Inicialização lazy de search/sync (podem falhar sem derrubar o workspace)
- [ ] `Drop` para cleanup do search engine se necessário

---

### 2.2 — Refatorar `AppManagedState` para multi-workspace

**Arquivo:** `src-tauri/src/state.rs`

```rust
pub struct AppManagedState {
    workspaces: Mutex<HashMap<WorkspaceId, WorkspaceContext>>,
    focused_id: Mutex<Option<WorkspaceId>>,
    pub save_coordinator: SaveCoordinator,
}
```

**Métodos:**

```rust
impl AppManagedState {
    pub fn new() -> Self { ... }

    // ─── Workspace Lifecycle ───

    /// Registra um novo workspace aberto
    pub fn register_workspace(
        &self,
        id: WorkspaceId,
        context: WorkspaceContext,
    ) -> Result<(), CommandError> { ... }

    /// Remove um workspace do registro
    pub fn unregister_workspace(&self, id: &WorkspaceId) -> Result<(), CommandError> { ... }

    /// Define qual workspace está em foco
    pub fn set_focused(&self, id: Option<WorkspaceId>) -> Result<(), CommandError> { ... }

    /// Retorna o ID do workspace em foco
    pub fn get_focused_id(&self) -> Result<Option<WorkspaceId>, CommandError> { ... }

    // ─── Acesso ao Workspace Ativo ───

    /// Retorna root_path do workspace em foco (backward compat)
    pub fn get_workspace_root(&self) -> Result<PathBuf, CommandError> { ... }

    /// Retorna root_path de um workspace específico por ID
    pub fn get_workspace_root_by_id(
        &self,
        id: &WorkspaceId,
    ) -> Result<PathBuf, CommandError> { ... }

    /// Executa closure com acesso ao WorkspaceContext
    pub fn with_workspace<F, R>(
        &self,
        id: &WorkspaceId,
        f: F,
    ) -> Result<R, CommandError>
    where
        F: FnOnce(&WorkspaceContext) -> Result<R, CommandError> { ... }

    /// Executa closure com acesso mutável ao WorkspaceContext
    pub fn with_workspace_mut<F, R>(
        &self,
        id: &WorkspaceId,
        f: F,
    ) -> Result<R, CommandError>
    where
        F: FnOnce(&mut WorkspaceContext) -> Result<R, CommandError> { ... }

    // ─── Search Engine (scoped por workspace) ───

    pub fn with_search_engine<F, R>(&self, f: F) -> Result<R, CommandError>
    where
        F: FnOnce(&SearchEngine) -> Result<R, CommandError> { ... }

    pub fn with_search_engine_for<F, R>(
        &self,
        workspace_id: &WorkspaceId,
        f: F,
    ) -> Result<R, CommandError>
    where
        F: FnOnce(&SearchEngine) -> Result<R, CommandError> { ... }

    // ─── Helpers ───

    /// Resolve WorkspaceId: se Some usa direto, se None usa focused
    pub fn resolve_workspace_id(
        &self,
        workspace_id: Option<WorkspaceId>,
    ) -> Result<WorkspaceId, CommandError> { ... }

    /// Lista todos os workspaces abertos
    pub fn list_open_workspaces(&self) -> Result<Vec<(WorkspaceId, String)>, CommandError> { ... }
}
```

**Critérios:**
- [ ] `get_workspace_root()` (sem parâmetro) continua funcionando → usa focused
- [ ] `with_search_engine()` (sem ID) → usa focused → **backward compat total**
- [ ] Novos métodos `*_by_id` / `*_for` para acesso explícito
- [ ] Locks granulares: Mutex no HashMap, não em cada WorkspaceContext
- [ ] Testes para register/unregister/focus/resolve

---

### 2.3 — Backward-compatible `set_workspace_root` / `init_search_engine`

**Arquivo:** `src-tauri/src/state.rs`

Manter as assinaturas existentes como wrappers:

```rust
/// DEPRECATED: Use register_workspace.
/// Mantido para compatibilidade durante migração dos commands.
pub fn set_workspace_root(&self, path: Option<PathBuf>) -> Result<(), CommandError> {
    // Se path == None, unregister focused
    // Se path == Some, register como novo workspace + set focused
}

/// DEPRECATED: Use with_workspace_mut + init_search.
pub fn init_search_engine(&self, workspace_root: &Path) -> Result<(), CommandError> {
    // Encontra workspace por root_path e inicializa search
}

/// DEPRECATED: Use with_workspace_mut + init_sync.
pub fn init_sync_coordinator(&self, workspace_root: &Path) -> Result<(), CommandError> {
    // Encontra workspace por root_path e inicializa sync
}
```

**Critérios:**
- [ ] Commands existentes (`commands/workspace.rs`) continuam funcionando SEM mudanças
- [ ] Estes wrappers são marcados com `#[deprecated]` para futura remoção
- [ ] Testes existentes em `state.rs` continuam passando sem alteração

---

### 2.4 — Atualizar `CommandError` para multi-workspace

**Arquivo:** `src-tauri/src/error.rs`

```rust
pub enum CommandError {
    NoWorkspace,
    WorkspaceNotFound(String),      // NOVO: workspace_id não registrado
    // ... existentes ...
}
```

**Critérios:**
- [ ] Novo variant não quebra matches existentes (adição)
- [ ] Mensagem clara: "Workspace {id} is not open"

---

### 2.5 — Testes unitários do novo state

**Arquivo:** `src-tauri/src/state.rs` (mod tests)

| Teste | Descrição |
|-------|-----------|
| `register_and_unregister_workspace` | Register → get_root_by_id → unregister → NotFound |
| `focused_workspace_returns_correct_root` | Focus A → get_root = A, focus B → get_root = B |
| `backward_compat_get_workspace_root` | set_workspace_root + get_workspace_root funciona |
| `resolve_workspace_id_uses_focused` | resolve(None) = focused_id |
| `resolve_workspace_id_explicit` | resolve(Some(id)) = id dado |
| `resolve_without_focused_errors` | resolve(None) sem focused → NoWorkspace |
| `unregister_focused_clears_focus` | Unregister focused → focused = None |
| `multiple_workspaces_coexist` | 3 workspaces, acessa cada um por ID |
| `with_workspace_closure_access` | with_workspace lê root_path corretamente |
| `list_open_workspaces` | 2 registrados → lista 2 entries |
| `save_coordinator_works_across_workspaces` | Locks por page_id global, não por workspace |

**Critérios:**
- [ ] Todos os testes existentes passam (sem modificação)
- [ ] Novos testes cobrem cenários multi-workspace
- [ ] Coverage ≥ 85%

---

### 2.6 — Constraint de memória: limite de workspaces simultâneos

**Arquivo:** `src-tauri/src/state.rs`

```rust
const MAX_OPEN_WORKSPACES: usize = 10;
```

`register_workspace` retorna erro se limite atingido:
```rust
CommandError::Validation("Maximum of 10 simultaneous workspaces reached".to_string())
```

**Critérios:**
- [ ] Limite configurável (constante, possível setting futuro)
- [ ] Teste para limite atingido

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src-tauri/src/state.rs` | Refatoração major — nova arquitetura |
| `src-tauri/src/error.rs` | Adição de variant `WorkspaceNotFound` |

## Arquivos NÃO Modificados (ainda)

- `src-tauri/src/commands/*.rs` — Fase 3
- `src-tauri/src/lib.rs` — Sem mudanças
- `src/` — Sem mudanças frontend
- `crates/` — Sem mudanças (fundação da Fase 1 é suficiente)

---

## Critérios de Aceitação da Fase

- [ ] `cargo test -p open-note` passa (testes do src-tauri)
- [ ] `cargo clippy --workspace -- -D warnings` limpo
- [ ] Commands existentes continuam funcionando via wrappers deprecated
- [ ] Nenhum IPC command precisa de alteração para esta fase
- [ ] Estado multi-workspace funcional internamente (testes provam)
- [ ] PR review aprovado

---

## Notas de Design

### Por que HashMap<WorkspaceId, ...> e não Vec?

- Lookup O(1) por ID vs O(n) scan
- IPC commands terão `workspace_id` como parâmetro — precisa de acesso direto
- Não importa ordem para o backend (ordem é concern do frontend)

### Por que Mutex<HashMap> e não RwLock?

- Writes são frequentes (register/unregister/init_search/init_sync)
- HashMap inteiro sob um Mutex é mais simples que RwLock + interior mutability
- WorkspaceContext tem `Option<SearchEngine>` que precisa de `&mut` para init
- Se performance for problema, migrar para `DashMap` ou `RwLock` depois (medição primeiro)

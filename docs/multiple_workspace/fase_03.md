# Fase 03 — IPC Commands Migration (workspace_id em todos os commands)

**Esforço estimado:** ~25 horas  
**Prioridade:** 🔴 Crítica  
**Dependências:** Fase 02  
**Branch:** `feat/multi-workspace-phase-3`

---

## Objetivo

Migrar todos os IPC commands para aceitar um parâmetro opcional `workspace_id`. Quando omitido, usa o workspace em foco (backward compat). Quando fornecido, opera no workspace especificado.

---

## Contexto Atual

Todos os 30+ commands seguem este padrão:

```rust
#[tauri::command]
pub fn list_notebooks(state: State<AppManagedState>) -> Result<Vec<Notebook>, CommandError> {
    let root = state.get_workspace_root()?;  // ← sempre o focused
    FsStorageEngine::list_notebooks(&root).map_err(CommandError::from)
}
```

O frontend chama sem contexto de workspace:

```typescript
export const listNotebooks = () => invoke<Notebook[]>("list_notebooks");
```

---

## Estratégia de Migração

### Abordagem: Optional Parameter + Resolve

Cada command ganha `workspace_id: Option<String>`:

```rust
#[tauri::command]
pub fn list_notebooks(
    state: State<AppManagedState>,
    workspace_id: Option<String>,        // NOVO — opcional
) -> Result<Vec<Notebook>, CommandError> {
    let ws_id = resolve_workspace_id(&state, workspace_id)?;
    let root = state.get_workspace_root_by_id(&ws_id)?;
    FsStorageEngine::list_notebooks(&root).map_err(CommandError::from)
}
```

**Helper de resolução:**

```rust
// src-tauri/src/commands/mod.rs
pub(crate) fn resolve_workspace_id(
    state: &AppManagedState,
    workspace_id: Option<String>,
) -> Result<WorkspaceId, CommandError> {
    match workspace_id {
        Some(id_str) => {
            let uuid = uuid::Uuid::parse_str(&id_str)
                .map_err(|_| CommandError::Validation(format!("Invalid workspace ID: {id_str}")))?;
            Ok(WorkspaceId::from(uuid))
        }
        None => state
            .get_focused_id()?
            .ok_or(CommandError::NoWorkspace),
    }
}
```

### Compatibilidade com Frontend

O parâmetro `workspace_id` é **opcional** no Tauri. Se o frontend não envia, o valor é `None` → resolve para focused. **Zero breaking changes no frontend**.

---

## Tarefas

### 3.1 — Helper `resolve_workspace_id` no mod.rs

**Arquivo:** `src-tauri/src/commands/mod.rs`

Adicionar função utilitária conforme descrito acima.

**Critérios:**
- [ ] Aceita `Option<String>` (Tauri serializa UUID como string)
- [ ] `None` → focused workspace
- [ ] `Some(invalid)` → `CommandError::Validation`
- [ ] `Some(valid_but_not_open)` → `CommandError::WorkspaceNotFound`
- [ ] Testes unitários

---

### 3.2 — Migrar commands de Workspace

**Arquivo:** `src-tauri/src/commands/workspace.rs`

| Command | Mudança |
|---------|---------|
| `create_workspace` | Registra no state via `register_workspace` em vez de `set_workspace_root` |
| `open_workspace` | Registra no state, define focused |
| `close_workspace` | Aceita `workspace_id: Option<String>` — se None, fecha focused |
| `get_workspace_settings` | Aceita `workspace_id: Option<String>` |
| `update_workspace_settings` | Aceita `workspace_id: Option<String>` |

**Novo command:**
```rust
#[tauri::command]
pub fn list_open_workspaces(
    state: State<AppManagedState>,
) -> Result<Vec<ActiveWorkspace>, CommandError> { ... }

#[tauri::command]
pub fn focus_workspace(
    state: State<AppManagedState>,
    workspace_id: String,
) -> Result<(), CommandError> { ... }

#[tauri::command]
pub fn switch_workspace(
    state: State<AppManagedState>,
    workspace_id: String,
) -> Result<Workspace, CommandError> {
    // Foca no workspace e retorna seus dados
}
```

**Critérios:**
- [ ] `open_workspace` registra novo context sem fechar os outros
- [ ] `close_workspace(None)` fecha o focused
- [ ] `close_workspace(Some(id))` fecha workspace específico
- [ ] Novos commands registrados em `lib.rs`

---

### 3.3 — Migrar commands de Notebook

**Arquivo:** `src-tauri/src/commands/notebook.rs`

| Command | Parâmetro adicionado |
|---------|---------------------|
| `list_notebooks` | `workspace_id: Option<String>` |
| `create_notebook` | `workspace_id: Option<String>` |
| `rename_notebook` | `workspace_id: Option<String>` |
| `delete_notebook` | `workspace_id: Option<String>` |
| `reorder_notebooks` | `workspace_id: Option<String>` |

**Critérios:**
- [ ] Todos usam `resolve_workspace_id` + `get_workspace_root_by_id`
- [ ] Sem `workspace_id` → funciona como antes (focused)

---

### 3.4 — Migrar commands de Section

**Arquivo:** `src-tauri/src/commands/section.rs`

| Command | Parâmetro adicionado |
|---------|---------------------|
| `list_sections` | `workspace_id: Option<String>` |
| `create_section` | `workspace_id: Option<String>` |
| `rename_section` | `workspace_id: Option<String>` |
| `delete_section` | `workspace_id: Option<String>` |
| `reorder_sections` | `workspace_id: Option<String>` |

**Critérios:**
- [ ] Mesmo padrão das tarefas anteriores

---

### 3.5 — Migrar commands de Page

**Arquivo:** `src-tauri/src/commands/page.rs`

| Command | Parâmetro adicionado |
|---------|---------------------|
| `list_pages` | `workspace_id: Option<String>` |
| `load_page` | `workspace_id: Option<String>` |
| `create_page` | `workspace_id: Option<String>` |
| `update_page` | `workspace_id: Option<String>` |
| `update_page_blocks` | `workspace_id: Option<String>` |
| `delete_page` | `workspace_id: Option<String>` |
| `move_page` | `workspace_id: Option<String>` |

**Critérios:**
- [ ] `update_page` e `update_page_blocks` usam `save_coordinator.with_page_lock` (sem mudança)
- [ ] SaveCoordinator é global (locks por page_id, não por workspace) — OK

---

### 3.6 — Migrar commands de Search

**Arquivo:** `src-tauri/src/commands/search.rs`

| Command | Parâmetro adicionado |
|---------|---------------------|
| `search_pages` | `workspace_id: Option<String>` |
| `quick_open` | `workspace_id: Option<String>` |
| `reindex_page` | `workspace_id: Option<String>` |
| `rebuild_index` | `workspace_id: Option<String>` |
| `get_index_status` | `workspace_id: Option<String>` |

**Critérios:**
- [ ] Usa `with_search_engine_for(ws_id)` em vez de `with_search_engine()`
- [ ] Search engine é por workspace (cada um tem seu índice Tantivy)

---

### 3.7 — Migrar commands de Trash

**Arquivo:** `src-tauri/src/commands/trash.rs`

| Command | Parâmetro adicionado |
|---------|---------------------|
| `list_trash_items` | `workspace_id: Option<String>` |
| `restore_from_trash` | `workspace_id: Option<String>` |
| `permanently_delete` | `workspace_id: Option<String>` |
| `empty_trash` | `workspace_id: Option<String>` |

**Critérios:**
- [ ] Lixeira é por workspace — resolve root_path correto

---

### 3.8 — Migrar commands de Assets

**Arquivo:** `src-tauri/src/commands/assets.rs`

| Command | Parâmetro adicionado |
|---------|---------------------|
| `import_asset` | `workspace_id: Option<String>` |
| `read_asset_base64` | Sem mudança (path absoluto) |
| `import_pdf` | `workspace_id: Option<String>` |

**Critérios:**
- [ ] `read_asset_base64` já recebe path absoluto — não precisa de workspace_id

---

### 3.9 — Migrar commands de Tags e Sync

**Arquivo:** `src-tauri/src/commands/tags.rs`, `src-tauri/src/commands/sync.rs`

| Command | Parâmetro adicionado |
|---------|---------------------|
| `list_all_tags` | `workspace_id: Option<String>` |
| `get_sync_providers` | Sem mudança (global) |
| `get_sync_status` | `workspace_id: Option<String>` |
| `get_sync_config` | `workspace_id: Option<String>` |
| `set_sync_config` | `workspace_id: Option<String>` |
| `get_sync_conflicts` | `workspace_id: Option<String>` |
| `resolve_sync_conflict` | `workspace_id: Option<String>` |

---

### 3.10 — Registrar novos commands em lib.rs

**Arquivo:** `src-tauri/src/lib.rs`

Adicionar ao `generate_handler![]`:
- `list_open_workspaces`
- `focus_workspace`
- `switch_workspace`

**Critérios:**
- [ ] Todos os novos commands registrados
- [ ] App compila e inicia sem erros

---

### 3.11 — Atualizar `ipc.ts` com novos commands e parâmetro opcional

**Arquivo:** `src/lib/ipc.ts`

```typescript
// Novos commands
export const listOpenWorkspaces = () =>
  invoke<ActiveWorkspace[]>("list_open_workspaces");

export const focusWorkspace = (workspaceId: string) =>
  invoke<void>("focus_workspace", { workspaceId });

export const switchWorkspace = (workspaceId: string) =>
  invoke<Workspace>("switch_workspace", { workspaceId });

// Exemplo de command atualizado (backward compat — workspace_id omitido = focused)
export const listNotebooks = (workspaceId?: string) =>
  invoke<Notebook[]>("list_notebooks", { workspaceId });
```

**IMPORTANTE:** Todos os calls existentes SEM `workspaceId` continuam funcionando. O parâmetro é opcional.

**Critérios:**
- [ ] Novos wrappers IPC para commands novos
- [ ] Commands existentes ganham `workspaceId?` opcional
- [ ] Frontend existente não precisa mudar (passa `undefined` = omitido)

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src-tauri/src/commands/mod.rs` | Novo helper `resolve_workspace_id` |
| `src-tauri/src/commands/workspace.rs` | Novos commands + refator |
| `src-tauri/src/commands/notebook.rs` | Parâmetro `workspace_id` |
| `src-tauri/src/commands/section.rs` | Parâmetro `workspace_id` |
| `src-tauri/src/commands/page.rs` | Parâmetro `workspace_id` |
| `src-tauri/src/commands/search.rs` | Parâmetro `workspace_id` |
| `src-tauri/src/commands/trash.rs` | Parâmetro `workspace_id` |
| `src-tauri/src/commands/assets.rs` | Parâmetro `workspace_id` (parcial) |
| `src-tauri/src/commands/tags.rs` | Parâmetro `workspace_id` |
| `src-tauri/src/commands/sync.rs` | Parâmetro `workspace_id` |
| `src-tauri/src/lib.rs` | Registrar novos commands |
| `src/lib/ipc.ts` | Novos wrappers + parâmetro opcional |

---

## Critérios de Aceitação da Fase

- [ ] `cargo test --workspace` passa
- [ ] `cargo clippy --workspace -- -D warnings` limpo
- [ ] App inicia e funciona normalmente (single workspace, sem parâmetro = focused)
- [ ] Novos commands (`list_open_workspaces`, `focus_workspace`, `switch_workspace`) respondem
- [ ] Frontend existente funciona sem nenhuma alteração de componente
- [ ] PR review aprovado

# Fase 02 — IPC: Comandos Tauri + TypeScript Bindings

## Objetivo

Expor os novos comportamentos do domínio (criar página canvas, salvar estado do
canvas) como comandos Tauri invocáveis pelo frontend, e adicionar as funções
correspondentes no `ipc.ts`.

**Pré-requisito:** Fase 01 concluída (compilação `crates/core` passando).

---

## Contexto

### Padrão existente a seguir

O par `create_pdf_canvas_page` / `update_page_annotations` é o modelo exato a
replicar para canvas:

| Existente (PDF Canvas) | Novo (Canvas) |
|---|---|
| `create_pdf_canvas_page` | `create_canvas_page` |
| `update_page_annotations` | `update_page_canvas_state` |

**Arquivo IPC Rust:** `src-tauri/src/commands/page.rs`
**Registro de comandos:** `src-tauri/src/lib.rs`
**Camada TS:** `src/lib/ipc.ts`

---

## Tarefas

### 2.1 — Comando `create_canvas_page` (Rust)

**Arquivo:** `src-tauri/src/commands/page.rs`

Adicionar após `create_pdf_canvas_page` (linha ~213):

```rust
#[tauri::command]
pub fn create_canvas_page(
    state: State<AppManagedState>,
    section_id: SectionId,
    title: String,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    let page = Page::new_canvas(section_id, &title).map_err(CommandError::from)?;
    let page =
        FsStorageEngine::create_page_from(&root, section_id, page).map_err(CommandError::from)?;
    try_index_page(&state, &root, &page);
    Ok(page)
}
```

> **Nota:** `FsStorageEngine::create_page_from` já existe e é usado por
> `create_pdf_canvas_page` — nenhuma mudança em `crates/storage/` é necessária.

---

### 2.2 — Comando `update_page_canvas_state` (Rust)

**Arquivo:** `src-tauri/src/commands/page.rs`

Adicionar após `update_page_annotations`:

```rust
#[tauri::command]
pub fn update_page_canvas_state(
    state: State<AppManagedState>,
    page_id: PageId,
    canvas_state: Option<serde_json::Value>,
    workspace_id: Option<String>,
) -> Result<(), CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    state.save_coordinator.with_page_lock(page_id, || {
        let mut page =
            FsStorageEngine::load_page(&root, page_id).map_err(CommandError::from)?;
        page.update_canvas_state(canvas_state);
        FsStorageEngine::update_page(&root, &page).map_err(CommandError::from)?;
        Ok(())
    })
}
```

> **`with_page_lock`** previne condições de corrida com o auto-save — padrão
> idêntico ao `update_page_blocks` e `update_page_annotations`.

---

### 2.3 — Registrar os novos comandos em `lib.rs`

**Arquivo:** `src-tauri/src/lib.rs`

Localizar o macro `tauri::generate_handler!` e adicionar os novos comandos:

```rust
tauri::generate_handler![
    // ... comandos existentes ...
    commands::page::create_pdf_canvas_page,
    commands::page::update_page_annotations,
    commands::page::create_canvas_page,           // NOVO
    commands::page::update_page_canvas_state,     // NOVO
    // ...
]
```

---

### 2.4 — Adicionar funções em `ipc.ts`

**Arquivo:** `src/lib/ipc.ts`

Adicionar na seção `// ─── PDF ───` (após `updatePageAnnotations`), criando
uma nova seção `// ─── Canvas ───`:

```typescript
// ─── Canvas ───

export const createCanvasPage = (
  sectionId: SectionId,
  title: string,
  workspaceId?: string,
) =>
  invoke<Page>("create_canvas_page", {
    sectionId,
    title,
    workspaceId,
  });

export const updatePageCanvasState = (
  pageId: PageId,
  canvasState: unknown | null,
  workspaceId?: string,
) =>
  invoke<void>("update_page_canvas_state", {
    pageId,
    canvasState,
    workspaceId,
  });
```

> **`unknown | null`** para `canvasState` evita depender de tipos internos do
> `@excalidraw/excalidraw` na camada IPC. O componente `CanvasPage` será
> responsável pelo cast correto.

---

### 2.5 — Verificar bindings TypeScript gerados

Após `cargo test -p opennote-core`, os seguintes arquivos devem estar
atualizados:

**`src/types/bindings/EditorMode.ts`:**
```typescript
export type EditorMode = "rich_text" | "markdown" | "pdf_canvas" | "canvas";
```

**`src/types/bindings/Page.ts`** — deve conter:
```typescript
canvas_state: any | null;
```

Se os bindings não forem gerados automaticamente pelo CI, rodar manualmente:
```bash
cargo test -p opennote-core
```

O `ts-rs` gera os bindings como side-effect dos testes unitários.

---

### 2.6 — Verificar que `FsStorageEngine::create_page_from` existe

**Arquivo:** `crates/storage/src/engine.rs` (ou equivalente)

Confirmar que o método já existe antes de usar em 2.1. Se não existir (improvável
dado que `create_pdf_canvas_page` já o usa), criar com a mesma assinatura.

```bash
grep -n "create_page_from" crates/storage/src/
```

---

## Verificação

```bash
# Compilar o workspace completo (valida IPC Rust)
cargo build

# Rodar testes de todos os crates
cargo test

# Verificar que os novos comandos estão registrados
grep -n "create_canvas_page\|update_page_canvas_state" src-tauri/src/lib.rs

# Verificar TypeScript compila
npm run type-check 2>/dev/null || npx tsc --noEmit
```

---

## Critérios de Aceite

- [ ] `cargo build` sem erros ou warnings relacionados às mudanças
- [ ] Ambos os novos comandos aparecem no `generate_handler!` de `lib.rs`
- [ ] `src/lib/ipc.ts` exporta `createCanvasPage` e `updatePageCanvasState`
- [ ] `EditorMode.ts` contém `"canvas"` como variante válida
- [ ] `Page.ts` contém `canvas_state: any | null`
- [ ] `npx tsc --noEmit` não reporta erros novos

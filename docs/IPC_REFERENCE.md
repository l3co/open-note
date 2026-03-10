# IPC Reference — Open Note

Referência completa dos **46 IPC commands** registrados no Tauri. Cada command é uma função Rust em `src-tauri/src/commands/` invocável pelo frontend via `invoke()`.

**Convenção:** O frontend chama via `src/lib/ipc.ts` que exporta wrappers tipados. Erros são retornados como `String` (Tauri padrão).

---

## Visão Geral por Módulo

| Módulo | Commands | Arquivo Rust | Descrição |
|---|---|---|---|
| App | 2 | `commands/mod.rs` | Info do app e estado global |
| Workspace | 8 | `commands/workspace.rs` | CRUD workspace + settings |
| Notebook | 5 | `commands/notebook.rs` | CRUD notebooks |
| Section | 5 | `commands/section.rs` | CRUD sections |
| Page | 7 | `commands/page.rs` | CRUD pages + file I/O |
| PDF Canvas | 3 | `commands/page.rs` | Import PDF + PDF Canvas pages + anotações |
| Tags | 1 | `commands/tags.rs` | Listar tags |
| Trash | 4 | `commands/trash.rs` | Lixeira |
| Assets | 3 | `commands/assets.rs` | Import/delete assets |
| Search | 5 | `commands/search.rs` | Busca full-text |
| Sync | 6 | `commands/sync.rs` | Sincronização cloud |
| **Total** | **49** | | |

---

## App (2 commands)

### `get_app_info`

Retorna nome e versão da aplicação.

| | Detalhe |
|---|---|
| **Rust** | `commands::get_app_info()` |
| **Parâmetros** | — |
| **Retorno** | `AppInfo { name: String, version: String }` |
| **Erros** | — |
| **TS** | `getAppInfo()` (não exposto em ipc.ts, usado internamente) |

### `get_app_state`

Retorna o estado global persistido (workspaces recentes, tema, idioma).

| | Detalhe |
|---|---|
| **Rust** | `commands::workspace::get_app_state()` |
| **Parâmetros** | — |
| **Retorno** | `AppState` |
| **Erros** | I/O ao ler `~/.opennote/app_state.json` |
| **TS** | `getAppState(): Promise<AppState>` |

---

## Workspace (8 commands)

### `create_workspace`

Cria novo workspace no filesystem.

| | Detalhe |
|---|---|
| **Rust** | `commands::workspace::create_workspace(state, path, name)` |
| **Parâmetros** | `path: String` — caminho absoluto, `name: String` — nome |
| **Retorno** | `Workspace` |
| **Erros** | Nome vazio, I/O |
| **Efeitos** | Cria diretório, `workspace.json`, `.trash/`, init SearchEngine + SyncCoordinator, atualiza AppState |
| **TS** | `createWorkspace(path, name): Promise<Workspace>` |

### `open_workspace`

Abre workspace existente.

| | Detalhe |
|---|---|
| **Rust** | `commands::workspace::open_workspace(state, path)` |
| **Parâmetros** | `path: String` — caminho absoluto |
| **Retorno** | `Workspace` |
| **Erros** | `WorkspaceNotFound`, `WorkspaceLocked`, I/O |
| **Efeitos** | Acquire `.lock`, init SearchEngine + SyncCoordinator, atualiza AppState |
| **TS** | `openWorkspace(path): Promise<Workspace>` |

### `close_workspace`

Fecha workspace atual.

| | Detalhe |
|---|---|
| **Rust** | `commands::workspace::close_workspace(state)` |
| **Parâmetros** | — |
| **Retorno** | `()` |
| **Erros** | Sem workspace aberto |
| **Efeitos** | Release `.lock`, limpa workspace_root |
| **TS** | `closeWorkspace(): Promise<void>` |

### `remove_recent_workspace`

Remove workspace da lista de recentes.

| | Detalhe |
|---|---|
| **Rust** | `commands::workspace::remove_recent_workspace(path)` |
| **Parâmetros** | `path: String` |
| **Retorno** | `()` |
| **TS** | `removeRecentWorkspace(path): Promise<void>` |

### `get_workspace_settings`

Retorna settings do workspace atual.

| | Detalhe |
|---|---|
| **Rust** | `commands::workspace::get_workspace_settings(state)` |
| **Parâmetros** | — |
| **Retorno** | `WorkspaceSettings` |
| **TS** | `getWorkspaceSettings(): Promise<WorkspaceSettings>` |

### `update_workspace_settings`

Atualiza settings do workspace atual.

| | Detalhe |
|---|---|
| **Rust** | `commands::workspace::update_workspace_settings(state, settings)` |
| **Parâmetros** | `settings: WorkspaceSettings` |
| **Retorno** | `()` |
| **TS** | `updateWorkspaceSettings(settings): Promise<void>` |

### `get_global_settings`

Retorna settings globais (tema, idioma, janela).

| | Detalhe |
|---|---|
| **Rust** | `commands::workspace::get_global_settings()` |
| **Parâmetros** | — |
| **Retorno** | `GlobalSettings` |
| **TS** | `getGlobalSettings(): Promise<GlobalSettings>` |

### `update_global_settings`

Atualiza settings globais.

| | Detalhe |
|---|---|
| **Rust** | `commands::workspace::update_global_settings(settings)` |
| **Parâmetros** | `settings: GlobalSettings` |
| **Retorno** | `()` |
| **TS** | `updateGlobalSettings(settings): Promise<void>` |

---

## Notebook (5 commands)

### `list_notebooks`

Lista todos os notebooks do workspace.

| | Detalhe |
|---|---|
| **Rust** | `commands::notebook::list_notebooks(state)` |
| **Parâmetros** | — |
| **Retorno** | `Vec<Notebook>` |
| **TS** | `listNotebooks(): Promise<Notebook[]>` |

### `create_notebook`

Cria novo notebook.

| | Detalhe |
|---|---|
| **Rust** | `commands::notebook::create_notebook(state, name)` |
| **Parâmetros** | `name: String` |
| **Retorno** | `Notebook` |
| **Erros** | `NotebookAlreadyExists`, nome vazio |
| **Efeitos** | Cria diretório + `notebook.json` |
| **TS** | `createNotebook(name): Promise<Notebook>` |

### `rename_notebook`

Renomeia notebook existente.

| | Detalhe |
|---|---|
| **Rust** | `commands::notebook::rename_notebook(state, id, name)` |
| **Parâmetros** | `id: NotebookId`, `name: String` |
| **Retorno** | `Notebook` |
| **Erros** | `NotebookNotFound`, nome vazio |
| **TS** | `renameNotebook(id, name): Promise<Notebook>` |

### `delete_notebook`

Deleta notebook (soft-delete para `.trash/`).

| | Detalhe |
|---|---|
| **Rust** | `commands::notebook::delete_notebook(state, id)` |
| **Parâmetros** | `id: NotebookId` |
| **Retorno** | `()` |
| **Erros** | `NotebookNotFound` |
| **TS** | `deleteNotebook(id): Promise<void>` |

### `reorder_notebooks`

Reordena notebooks.

| | Detalhe |
|---|---|
| **Rust** | `commands::notebook::reorder_notebooks(state, order)` |
| **Parâmetros** | `order: Vec<(NotebookId, u32)>` — pares (id, nova posição) |
| **Retorno** | `()` |
| **TS** | `reorderNotebooks(order): Promise<void>` |

---

## Section (5 commands)

### `list_sections`

Lista sections de um notebook.

| | Detalhe |
|---|---|
| **Rust** | `commands::section::list_sections(state, notebook_id)` |
| **Parâmetros** | `notebook_id: NotebookId` |
| **Retorno** | `Vec<Section>` |
| **TS** | `listSections(notebookId): Promise<Section[]>` |

### `create_section`

Cria nova section em um notebook.

| | Detalhe |
|---|---|
| **Rust** | `commands::section::create_section(state, notebook_id, name)` |
| **Parâmetros** | `notebook_id: NotebookId`, `name: String` |
| **Retorno** | `Section` |
| **Erros** | `SectionAlreadyExists`, `NotebookNotFound`, nome vazio |
| **Efeitos** | Cria diretório + `section.json` + `assets/` |
| **TS** | `createSection(notebookId, name): Promise<Section>` |

### `rename_section`

Renomeia section.

| | Detalhe |
|---|---|
| **Rust** | `commands::section::rename_section(state, id, name)` |
| **Parâmetros** | `id: SectionId`, `name: String` |
| **Retorno** | `Section` |
| **TS** | `renameSection(id, name): Promise<Section>` |

### `delete_section`

Deleta section (soft-delete).

| | Detalhe |
|---|---|
| **Rust** | `commands::section::delete_section(state, id)` |
| **Parâmetros** | `id: SectionId` |
| **Retorno** | `()` |
| **TS** | `deleteSection(id): Promise<void>` |

### `reorder_sections`

Reordena sections.

| | Detalhe |
|---|---|
| **Rust** | `commands::section::reorder_sections(state, order)` |
| **Parâmetros** | `order: Vec<(SectionId, u32)>` |
| **Retorno** | `()` |
| **TS** | `reorderSections(order): Promise<void>` |

---

## Page (7 commands)

### `list_pages`

Lista resumos de pages de uma section.

| | Detalhe |
|---|---|
| **Rust** | `commands::page::list_pages(state, section_id)` |
| **Parâmetros** | `section_id: SectionId` |
| **Retorno** | `Vec<PageSummary>` — id, title, tags, created_at, updated_at |
| **TS** | `listPages(sectionId): Promise<PageSummary[]>` |

### `load_page`

Carrega page completa (com todos os blocos).

| | Detalhe |
|---|---|
| **Rust** | `commands::page::load_page(state, page_id)` |
| **Parâmetros** | `page_id: PageId` |
| **Retorno** | `Page` |
| **Erros** | `PageNotFound` |
| **TS** | `loadPage(pageId): Promise<Page>` |

### `create_page`

Cria nova page em uma section.

| | Detalhe |
|---|---|
| **Rust** | `commands::page::create_page(state, section_id, title)` |
| **Parâmetros** | `section_id: SectionId`, `title: String` |
| **Retorno** | `Page` |
| **Erros** | Título vazio, section not found |
| **Efeitos** | Cria `{slug}.opn.json` |
| **TS** | `createPage(sectionId, title): Promise<Page>` |

### `update_page`

Atualiza page inteira (título, tags, annotations, preferences).

| | Detalhe |
|---|---|
| **Rust** | `commands::page::update_page(state, page)` |
| **Parâmetros** | `page: Page` — page completa |
| **Retorno** | `()` |
| **TS** | `updatePage(page): Promise<void>` |

### `update_page_blocks`

Atualiza apenas os blocos de uma page (usado pelo auto-save).

| | Detalhe |
|---|---|
| **Rust** | `commands::page::update_page_blocks(state, page_id, blocks)` |
| **Parâmetros** | `page_id: PageId`, `blocks: Vec<Block>` |
| **Retorno** | `Page` — page atualizada |
| **Erros** | `PageNotFound` |
| **Efeitos** | Usa `SaveCoordinator` (Mutex per-page) para read-modify-write seguro |
| **TS** | `updatePageBlocks(pageId, blocks): Promise<Page>` |

### `delete_page`

Deleta page (soft-delete para `.trash/`).

| | Detalhe |
|---|---|
| **Rust** | `commands::page::delete_page(state, page_id)` |
| **Parâmetros** | `page_id: PageId` |
| **Retorno** | `()` |
| **TS** | `deletePage(pageId): Promise<void>` |

### `move_page`

Move page para outra section.

| | Detalhe |
|---|---|
| **Rust** | `commands::page::move_page(state, page_id, target_section_id)` |
| **Parâmetros** | `page_id: PageId`, `target_section_id: SectionId` |
| **Retorno** | `Page` — page atualizada |
| **Efeitos** | Move arquivo + assets para a section destino |
| **TS** | `movePage(pageId, targetSectionId): Promise<Page>` |

---

## File I/O (2 commands)

### `read_file_content`

Lê conteúdo de arquivo como texto.

| | Detalhe |
|---|---|
| **Rust** | `commands::page::read_file_content(path)` |
| **Parâmetros** | `path: String` — caminho absoluto |
| **Retorno** | `String` |
| **TS** | `readFileContent(path): Promise<string>` |

### `save_file_content`

Escreve conteúdo em arquivo.

| | Detalhe |
|---|---|
| **Rust** | `commands::page::save_file_content(path, content)` |
| **Parâmetros** | `path: String`, `content: String` |
| **Retorno** | `()` |
| **TS** | `saveFileContent(path, content): Promise<void>` |

---

## PDF Canvas (3 commands)

### `import_pdf`

Importa arquivo PDF como asset de uma section.

| | Detalhe |
|---|---|
| **Rust** | `commands::page::import_pdf(state, section_id, file_path)` |
| **Parâmetros** | `section_id: SectionId`, `file_path: String` — caminho absoluto do PDF |
| **Retorno** | `(String, String, u32)` — (caminho relativo do asset, caminho absoluto, total de páginas) |
| **Erros** | Arquivo não encontrado, I/O |
| **TS** | `importPdf(sectionId, filePath): Promise<[string, string, number]>` |

### `create_pdf_canvas_page`

Cria uma nova page do tipo `pdf_canvas` com o PDF já importado.

| | Detalhe |
|---|---|
| **Rust** | `commands::page::create_pdf_canvas_page(state, section_id, title, pdf_asset, pdf_total_pages)` |
| **Parâmetros** | `section_id: SectionId`, `title: String`, `pdf_asset: String` (caminho absoluto), `pdf_total_pages: u32` |
| **Retorno** | `Page` — page criada com `editor_mode: PdfCanvas` |
| **Erros** | Section não encontrada, I/O |
| **TS** | `createPdfCanvasPage(sectionId, title, pdfAsset, pdfTotalPages): Promise<Page>` |

### `update_page_annotations`

Salva as anotações (ink strokes) de uma PDF Canvas Page.

| | Detalhe |
|---|---|
| **Rust** | `commands::page::update_page_annotations(state, page_id, annotations)` |
| **Parâmetros** | `page_id: PageId`, `annotations: PageAnnotations` — mapa `pdf_page → [AnchoredStroke]` |
| **Retorno** | `()` |
| **Erros** | Page não encontrada, I/O |
| **TS** | `updatePageAnnotations(pageId, annotations): Promise<void>` |

---

## Tags (1 command)

### `list_all_tags`

Lista todas as tags de todas as pages do workspace (sorted, unique).

| | Detalhe |
|---|---|
| **Rust** | `commands::tags::list_all_tags(state)` |
| **Parâmetros** | — |
| **Retorno** | `Vec<String>` |
| **TS** | `listAllTags(): Promise<string[]>` |

---

## Trash (4 commands)

### `list_trash_items`

Lista itens na lixeira.

| | Detalhe |
|---|---|
| **Rust** | `commands::trash::list_trash_items(state)` |
| **Parâmetros** | — |
| **Retorno** | `Vec<TrashItem>` |
| **TS** | `listTrashItems(): Promise<TrashItem[]>` |

### `restore_from_trash`

Restaura item da lixeira para o local original.

| | Detalhe |
|---|---|
| **Rust** | `commands::trash::restore_from_trash(state, trash_item_id)` |
| **Parâmetros** | `trash_item_id: String` |
| **Retorno** | `()` |
| **Erros** | `TrashItemNotFound` |
| **TS** | `restoreFromTrash(trashItemId): Promise<void>` |

### `permanently_delete`

Remove item da lixeira permanentemente.

| | Detalhe |
|---|---|
| **Rust** | `commands::trash::permanently_delete(state, trash_item_id)` |
| **Parâmetros** | `trash_item_id: String` |
| **Retorno** | `()` |
| **Erros** | `TrashItemNotFound` |
| **TS** | `permanentlyDelete(trashItemId): Promise<void>` |

### `empty_trash`

Esvazia toda a lixeira.

| | Detalhe |
|---|---|
| **Rust** | `commands::trash::empty_trash(state)` |
| **Parâmetros** | — |
| **Retorno** | `()` |
| **TS** | `emptyTrash(): Promise<void>` |

---

## Assets (3 commands)

### `import_asset`

Importa arquivo como asset de uma section (cópia).

| | Detalhe |
|---|---|
| **Rust** | `commands::assets::import_asset(state, section_id, file_path)` |
| **Parâmetros** | `section_id: SectionId`, `file_path: String` |
| **Retorno** | `AssetResult { asset_path: String }` — caminho relativo |
| **TS** | `importAsset(sectionId, filePath)` |

### `import_asset_from_bytes`

Importa asset a partir de bytes (ex: paste de clipboard).

| | Detalhe |
|---|---|
| **Rust** | `commands::assets::import_asset_from_bytes(state, section_id, bytes, extension)` |
| **Parâmetros** | `section_id: SectionId`, `bytes: Vec<u8>`, `extension: String` |
| **Retorno** | `AssetResult { asset_path: String }` |
| **TS** | `importAssetFromBytes(sectionId, bytes, extension)` |

### `delete_asset`

Remove asset do filesystem.

| | Detalhe |
|---|---|
| **Rust** | `commands::assets::delete_asset(state, asset_path)` |
| **Parâmetros** | `asset_path: String` — caminho relativo |
| **Retorno** | `()` |
| **TS** | `deleteAsset(assetPath)` |

---

## Search (5 commands)

### `search_pages`

Busca full-text em todas as pages indexadas.

| | Detalhe |
|---|---|
| **Rust** | `commands::search::search_pages(state, query)` |
| **Parâmetros** | `query: SearchQuery` — `{ query: String, notebook_id?: String, section_id?: String, limit?: usize }` |
| **Retorno** | `SearchResults` — `{ items: Vec<SearchResultItem>, total: u64 }` |
| **TS** | `searchPages(query): Promise<SearchResults>` |

### `quick_open`

Busca rápida por título (QuickOpen dialog).

| | Detalhe |
|---|---|
| **Rust** | `commands::search::quick_open(state, query, limit)` |
| **Parâmetros** | `query: String`, `limit?: usize` (default 10) |
| **Retorno** | `Vec<SearchResultItem>` |
| **TS** | `quickOpen(query, limit?): Promise<SearchResultItem[]>` |

### `reindex_page`

Re-indexa uma page específica no search engine.

| | Detalhe |
|---|---|
| **Rust** | `commands::search::reindex_page(state, page_id)` |
| **Parâmetros** | `page_id: PageId` |
| **Retorno** | `()` |
| **Efeitos** | Remove documento antigo e insere novo no índice Tantivy |
| **TS** | `reindexPage(pageId): Promise<void>` |

### `rebuild_index`

Reconstrói todo o índice de busca do zero.

| | Detalhe |
|---|---|
| **Rust** | `commands::search::rebuild_index(state)` |
| **Parâmetros** | — |
| **Retorno** | `u64` — total de pages indexadas |
| **Efeitos** | Itera todos notebooks → sections → pages, re-indexa tudo |
| **TS** | `rebuildIndex(): Promise<number>` |

### `get_index_status`

Retorna status do índice de busca.

| | Detalhe |
|---|---|
| **Rust** | `commands::search::get_index_status(state)` |
| **Parâmetros** | — |
| **Retorno** | `IndexStatus` — `{ total_docs: u64, index_size_bytes: u64 }` |
| **TS** | `getIndexStatus(): Promise<IndexStatus>` |

---

## Sync (6 commands)

### `get_sync_providers`

Lista provedores de sync disponíveis com status de conexão.

| | Detalhe |
|---|---|
| **Rust** | `commands::sync::get_sync_providers(state)` |
| **Parâmetros** | — |
| **Retorno** | `Vec<ProviderInfo>` — `{ name, display_name, connected, user_email?, last_synced_at? }` |
| **TS** | `getSyncProviders(): Promise<ProviderInfo[]>` |

### `get_sync_status`

Retorna status atual da sincronização.

| | Detalhe |
|---|---|
| **Rust** | `commands::sync::get_sync_status(state)` |
| **Parâmetros** | — |
| **Retorno** | `SyncStatus` — `{ is_syncing, provider?, progress?, last_synced_at?, last_error?, pending_conflicts }` |
| **TS** | `getSyncStatus(): Promise<SyncStatus>` |

### `get_sync_config`

Retorna configuração de sync atual.

| | Detalhe |
|---|---|
| **Rust** | `commands::sync::get_sync_config(state)` |
| **Parâmetros** | — |
| **Retorno** | `SyncPreferences` — `{ enabled, provider?, interval_seconds, synced_notebook_ids }` |
| **TS** | `getSyncConfig(): Promise<SyncPreferences>` |

### `set_sync_config`

Atualiza configuração de sync.

| | Detalhe |
|---|---|
| **Rust** | `commands::sync::set_sync_config(state, config)` |
| **Parâmetros** | `config: SyncPreferences` |
| **Retorno** | `()` |
| **Erros** | Sync coordinator não inicializado |
| **Efeitos** | Se `provider` definido, cria instância do provider |
| **TS** | `setSyncConfig(config): Promise<void>` |

### `get_sync_conflicts`

Lista conflitos de sync pendentes.

| | Detalhe |
|---|---|
| **Rust** | `commands::sync::get_sync_conflicts(state)` |
| **Parâmetros** | — |
| **Retorno** | `Vec<SyncConflict>` |
| **TS** | `getSyncConflicts(): Promise<SyncConflict[]>` |

### `resolve_sync_conflict`

Resolve um conflito de sync específico.

| | Detalhe |
|---|---|
| **Rust** | `commands::sync::resolve_sync_conflict(state, conflict_id, resolution)` |
| **Parâmetros** | `conflict_id: String`, `resolution: ConflictResolution` (`keep_local`, `keep_remote`, `keep_both`) |
| **Retorno** | `()` |
| **Erros** | Conflito não encontrado, sync coordinator não inicializado |
| **TS** | `resolveSyncConflict(conflictId, resolution): Promise<void>` |

---

## Tipos Referenciados

Para definições completas dos tipos usados nos commands, ver:

- [DATA_MODEL.md](./DATA_MODEL.md) — Entidades, value objects, enums
- `src/types/bindings/` — TypeScript bindings gerados
- `src/types/search.ts` — Tipos de busca
- `src/types/sync.ts` — Tipos de sync

---

## Padrões de Uso

### Fluxo típico de um IPC command

```typescript
// Frontend (src/lib/ipc.ts)
export const createNotebook = (name: string) =>
  invoke<Notebook>("create_notebook", { name });

// Chamada a partir de um store
const notebook = await ipc.createNotebook("Estudos");
```

```rust
// Backend (src-tauri/src/commands/notebook.rs)
#[tauri::command]
pub fn create_notebook(state: State<AppManagedState>, name: String) -> Result<Notebook, String> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::create_notebook(&root, &name).map_err(|e| e.to_string())
}
```

### Serialização de argumentos

Tauri converte automaticamente entre `camelCase` (JS) e `snake_case` (Rust):
- Frontend envia: `{ notebookId: "abc-123" }`
- Rust recebe: `notebook_id: NotebookId`

### Tratamento de erros

Todos os commands retornam `Result<T, String>`. O frontend trata erros via try/catch:

```typescript
try {
  await ipc.createNotebook("Estudos");
} catch (error) {
  toast.error(t('errors.notebookAlreadyExists'));
}
```

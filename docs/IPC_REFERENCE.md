# IPC Reference — Open Note

Complete reference for the IPC commands registered in Tauri. Each command is a Rust function in `src-tauri/src/commands/` callable from the frontend via `invoke()`.

**Convention:** The frontend calls commands through typed wrappers in `src/lib/ipc.ts`. Errors are returned as `String` (Tauri default).

---

## Module Overview

| Module | Commands | Rust file | Description |
|---|---|---|---|
| App | 1 | `commands/mod.rs` | App info |
| Workspace | 14 | `commands/workspace.rs` | CRUD workspace + settings + multi-workspace |
| Notebook | 5 | `commands/notebook.rs` | CRUD notebooks |
| Section | 6 | `commands/section.rs` | CRUD sections + move |
| Page | 20 | `commands/page.rs` | CRUD pages + password protection + PDF canvas + canvas |
| Assets | 4 | `commands/assets.rs` | Import/read/delete assets |
| Tags | 1 | `commands/tags.rs` | List tags |
| Trash | 4 | `commands/trash.rs` | Trash management |
| Search | 6 | `commands/search.rs` | Full-text search |
| Sync | 17 | `commands/sync.rs` | Cloud synchronization |
| Template | 4 | `commands/template.rs` | Page templates |
| Spellcheck | 1 | `commands/spellcheck.rs` | Spell checking |
| **Total** | **83** | | |

---

## App (1 command)

### `get_app_info`

Returns the application name and version.

| | Detail |
|---|---|
| **Rust** | `commands::get_app_info()` |
| **Parameters** | — |
| **Returns** | `AppInfo { name: String, version: String }` |
| **Errors** | — |
| **TS** | `getAppInfo()` |

---

## Workspace (14 commands)

### `get_app_state`

Returns the persisted global state (recent workspaces, theme, language).

| | Detail |
|---|---|
| **Rust** | `commands::workspace::get_app_state()` |
| **Parameters** | — |
| **Returns** | `AppState` |
| **Errors** | I/O reading `~/.opennote/app_state.json` |
| **TS** | `getAppState(): Promise<AppState>` |

### `create_workspace`

Creates a new workspace on the filesystem.

| | Detail |
|---|---|
| **Rust** | `commands::workspace::create_workspace(state, path, name)` |
| **Parameters** | `path: String` — absolute path, `name: String` |
| **Returns** | `Workspace` |
| **Errors** | Empty name, I/O |
| **Effects** | Creates directory, `workspace.json`, `.trash/`, initializes SearchEngine + SyncCoordinator, updates AppState |
| **TS** | `createWorkspace(path, name): Promise<Workspace>` |

### `open_workspace`

Opens an existing workspace.

| | Detail |
|---|---|
| **Rust** | `commands::workspace::open_workspace(state, path)` |
| **Parameters** | `path: String` — absolute path |
| **Returns** | `Workspace` |
| **Errors** | `WorkspaceNotFound`, `WorkspaceLocked`, I/O |
| **Effects** | Acquires `.lock`, initializes SearchEngine + SyncCoordinator, updates AppState |
| **TS** | `openWorkspace(path): Promise<Workspace>` |

### `force_open_workspace`

Opens a workspace ignoring an existing lock (use when the lock is stale).

| | Detail |
|---|---|
| **Rust** | `commands::workspace::force_open_workspace(state, path)` |
| **Parameters** | `path: String` |
| **Returns** | `Workspace` |
| **TS** | `forceOpenWorkspace(path): Promise<Workspace>` |

### `close_workspace`

Closes the active workspace.

| | Detail |
|---|---|
| **Rust** | `commands::workspace::close_workspace(state)` |
| **Parameters** | — |
| **Returns** | `()` |
| **Errors** | No workspace open |
| **Effects** | Releases `.lock`, clears workspace context |
| **TS** | `closeWorkspace(): Promise<void>` |

### `list_open_workspaces`

Lists all currently open workspaces (up to 10).

| | Detail |
|---|---|
| **Rust** | `commands::workspace::list_open_workspaces(state)` |
| **Parameters** | — |
| **Returns** | `Vec<Workspace>` |
| **TS** | `listOpenWorkspaces(): Promise<Workspace[]>` |

### `focus_workspace`

Sets the active workspace (when multiple are open).

| | Detail |
|---|---|
| **Rust** | `commands::workspace::focus_workspace(state, workspace_id)` |
| **Parameters** | `workspace_id: WorkspaceId` |
| **Returns** | `Workspace` |
| **TS** | `focusWorkspace(workspaceId): Promise<Workspace>` |

### `switch_workspace`

Switches the active workspace, closing the previous one.

| | Detail |
|---|---|
| **Rust** | `commands::workspace::switch_workspace(state, path)` |
| **Parameters** | `path: String` |
| **Returns** | `Workspace` |
| **TS** | `switchWorkspace(path): Promise<Workspace>` |

### `remove_recent_workspace`

Removes a workspace from the recent list.

| | Detail |
|---|---|
| **Rust** | `commands::workspace::remove_recent_workspace(path)` |
| **Parameters** | `path: String` |
| **Returns** | `()` |
| **TS** | `removeRecentWorkspace(path): Promise<void>` |

### `get_workspace_settings`

Returns the current workspace settings.

| | Detail |
|---|---|
| **Rust** | `commands::workspace::get_workspace_settings(state)` |
| **Parameters** | — |
| **Returns** | `WorkspaceSettings` |
| **TS** | `getWorkspaceSettings(): Promise<WorkspaceSettings>` |

### `update_workspace_settings`

Updates the current workspace settings.

| | Detail |
|---|---|
| **Rust** | `commands::workspace::update_workspace_settings(state, settings)` |
| **Parameters** | `settings: WorkspaceSettings` |
| **Returns** | `()` |
| **TS** | `updateWorkspaceSettings(settings): Promise<void>` |

### `get_global_settings`

Returns global settings (theme, language, window).

| | Detail |
|---|---|
| **Rust** | `commands::workspace::get_global_settings()` |
| **Parameters** | — |
| **Returns** | `GlobalSettings` |
| **TS** | `getGlobalSettings(): Promise<GlobalSettings>` |

### `update_global_settings`

Updates global settings.

| | Detail |
|---|---|
| **Rust** | `commands::workspace::update_global_settings(settings)` |
| **Parameters** | `settings: GlobalSettings` |
| **Returns** | `()` |
| **TS** | `updateGlobalSettings(settings): Promise<void>` |

### `ensure_quick_notes`

Ensures the "Quick Notes" notebook and section exist, creating them if needed.

| | Detail |
|---|---|
| **Rust** | `commands::workspace::ensure_quick_notes(state)` |
| **Parameters** | — |
| **Returns** | `(Notebook, Section)` |
| **TS** | `ensureQuickNotes(): Promise<[Notebook, Section]>` |

---

## Notebook (5 commands)

### `list_notebooks`

Lists all notebooks in the workspace.

| | Detail |
|---|---|
| **Rust** | `commands::notebook::list_notebooks(state)` |
| **Parameters** | — |
| **Returns** | `Vec<Notebook>` |
| **TS** | `listNotebooks(): Promise<Notebook[]>` |

### `create_notebook`

Creates a new notebook.

| | Detail |
|---|---|
| **Rust** | `commands::notebook::create_notebook(state, name)` |
| **Parameters** | `name: String` |
| **Returns** | `Notebook` |
| **Errors** | `NotebookAlreadyExists`, empty name |
| **Effects** | Creates directory + `notebook.json` |
| **TS** | `createNotebook(name): Promise<Notebook>` |

### `rename_notebook`

Renames an existing notebook.

| | Detail |
|---|---|
| **Rust** | `commands::notebook::rename_notebook(state, id, name)` |
| **Parameters** | `id: NotebookId`, `name: String` |
| **Returns** | `Notebook` |
| **Errors** | `NotebookNotFound`, empty name |
| **TS** | `renameNotebook(id, name): Promise<Notebook>` |

### `delete_notebook`

Deletes a notebook (soft-delete to `.trash/`).

| | Detail |
|---|---|
| **Rust** | `commands::notebook::delete_notebook(state, id)` |
| **Parameters** | `id: NotebookId` |
| **Returns** | `()` |
| **Errors** | `NotebookNotFound` |
| **TS** | `deleteNotebook(id): Promise<void>` |

### `reorder_notebooks`

Reorders notebooks.

| | Detail |
|---|---|
| **Rust** | `commands::notebook::reorder_notebooks(state, order)` |
| **Parameters** | `order: Vec<(NotebookId, u32)>` — (id, new position) pairs |
| **Returns** | `()` |
| **TS** | `reorderNotebooks(order): Promise<void>` |

---

## Section (6 commands)

### `list_sections`

Lists sections in a notebook.

| | Detail |
|---|---|
| **Rust** | `commands::section::list_sections(state, notebook_id)` |
| **Parameters** | `notebook_id: NotebookId` |
| **Returns** | `Vec<Section>` |
| **TS** | `listSections(notebookId): Promise<Section[]>` |

### `create_section`

Creates a new section in a notebook.

| | Detail |
|---|---|
| **Rust** | `commands::section::create_section(state, notebook_id, name)` |
| **Parameters** | `notebook_id: NotebookId`, `name: String` |
| **Returns** | `Section` |
| **Errors** | `SectionAlreadyExists`, `NotebookNotFound`, empty name |
| **Effects** | Creates directory + `section.json` + `assets/` |
| **TS** | `createSection(notebookId, name): Promise<Section>` |

### `rename_section`

Renames a section.

| | Detail |
|---|---|
| **Rust** | `commands::section::rename_section(state, id, name)` |
| **Parameters** | `id: SectionId`, `name: String` |
| **Returns** | `Section` |
| **TS** | `renameSection(id, name): Promise<Section>` |

### `delete_section`

Deletes a section (soft-delete).

| | Detail |
|---|---|
| **Rust** | `commands::section::delete_section(state, id)` |
| **Parameters** | `id: SectionId` |
| **Returns** | `()` |
| **TS** | `deleteSection(id): Promise<void>` |

### `reorder_sections`

Reorders sections within a notebook.

| | Detail |
|---|---|
| **Rust** | `commands::section::reorder_sections(state, order)` |
| **Parameters** | `order: Vec<(SectionId, u32)>` |
| **Returns** | `()` |
| **TS** | `reorderSections(order): Promise<void>` |

### `move_section`

Moves a section to another notebook.

| | Detail |
|---|---|
| **Rust** | `commands::section::move_section(state, section_id, target_notebook_id, workspace_id)` |
| **Parameters** | `section_id: SectionId`, `target_notebook_id: NotebookId`, `workspace_id?: String` |
| **Returns** | `Section` |
| **Effects** | Moves the section directory, updates `notebook_id` and slug |
| **TS** | `moveSection(sectionId, targetNotebookId, workspaceId?): Promise<Section>` |

---

## Page (20 commands)

### `list_pages`

Lists page summaries for a section.

| | Detail |
|---|---|
| **Rust** | `commands::page::list_pages(state, section_id)` |
| **Parameters** | `section_id: SectionId` |
| **Returns** | `Vec<PageSummary>` — id, title, tags, created_at, updated_at |
| **TS** | `listPages(sectionId): Promise<PageSummary[]>` |

### `load_page`

Loads a full page (with all blocks).

| | Detail |
|---|---|
| **Rust** | `commands::page::load_page(state, page_id)` |
| **Parameters** | `page_id: PageId` |
| **Returns** | `Page` |
| **Errors** | `PageNotFound` |
| **TS** | `loadPage(pageId): Promise<Page>` |

### `create_page`

Creates a new page in a section.

| | Detail |
|---|---|
| **Rust** | `commands::page::create_page(state, section_id, title)` |
| **Parameters** | `section_id: SectionId`, `title: String` |
| **Returns** | `Page` |
| **Errors** | Empty title, section not found |
| **Effects** | Creates `{slug}.opn.json` |
| **TS** | `createPage(sectionId, title): Promise<Page>` |

### `update_page`

Updates an entire page (title, tags, annotations, preferences).

| | Detail |
|---|---|
| **Rust** | `commands::page::update_page(state, page)` |
| **Parameters** | `page: Page` — full page object |
| **Returns** | `()` |
| **TS** | `updatePage(page): Promise<void>` |

### `update_page_blocks`

Updates only the blocks of a page (used by auto-save).

| | Detail |
|---|---|
| **Rust** | `commands::page::update_page_blocks(state, page_id, blocks)` |
| **Parameters** | `page_id: PageId`, `blocks: Vec<Block>` |
| **Returns** | `Page` — updated page |
| **Errors** | `PageNotFound` |
| **Effects** | Uses `SaveCoordinator` (per-page Mutex) for safe read-modify-write |
| **TS** | `updatePageBlocks(pageId, blocks): Promise<Page>` |

### `delete_page`

Deletes a page (soft-delete to `.trash/`).

| | Detail |
|---|---|
| **Rust** | `commands::page::delete_page(state, page_id)` |
| **Parameters** | `page_id: PageId` |
| **Returns** | `()` |
| **TS** | `deletePage(pageId): Promise<void>` |

### `move_page`

Moves a page to another section.

| | Detail |
|---|---|
| **Rust** | `commands::page::move_page(state, page_id, target_section_id)` |
| **Parameters** | `page_id: PageId`, `target_section_id: SectionId` |
| **Returns** | `Page` — updated page |
| **Effects** | Moves file + assets to the target section |
| **TS** | `movePage(pageId, targetSectionId): Promise<Page>` |

### `unlock_page`

Unlocks a password-protected page for this session.

| | Detail |
|---|---|
| **Rust** | `commands::page::unlock_page(state, page_id, password, workspace_id)` |
| **Parameters** | `page_id: PageId`, `password: String`, `workspace_id?: String` |
| **Returns** | `Page` — decrypted page (in memory) |
| **Errors** | `WRONG_PASSWORD`, `PageNotFound` |
| **Effects** | Stores the derived key in the workspace session cache (RAM) |
| **TS** | `unlockPage(pageId, password, workspaceId?): Promise<Page>` |

### `set_page_password`

Protects a page with a password for the first time.

| | Detail |
|---|---|
| **Rust** | `commands::page::set_page_password(state, page_id, password, workspace_id)` |
| **Parameters** | `page_id: PageId`, `password: String`, `workspace_id?: String` |
| **Returns** | `()` |
| **Errors** | Password too short (<6 chars), page already protected |
| **Effects** | Encrypts content, removes from search index, caches key in session |
| **TS** | `setPagePassword(pageId, password, workspaceId?): Promise<void>` |

### `remove_page_password`

Permanently removes password protection from a page.

| | Detail |
|---|---|
| **Rust** | `commands::page::remove_page_password(state, page_id, password, workspace_id)` |
| **Parameters** | `page_id: PageId`, `password: String`, `workspace_id?: String` |
| **Returns** | `Page` — now unprotected page |
| **Errors** | `WRONG_PASSWORD` |
| **Effects** | Decrypts file on disk, removes key from session, re-indexes for search |
| **TS** | `removePagePassword(pageId, password, workspaceId?): Promise<Page>` |

### `change_page_password`

Changes a page's password (key rotation).

| | Detail |
|---|---|
| **Rust** | `commands::page::change_page_password(state, page_id, old_password, new_password, workspace_id)` |
| **Parameters** | `page_id: PageId`, `old_password`, `new_password`, `workspace_id?` |
| **Returns** | `()` |
| **Errors** | `WRONG_PASSWORD`, password too short |
| **Effects** | Re-encrypts with new key + new salt/nonce, removes old key from session |
| **TS** | `changePagePassword(pageId, oldPw, newPw, workspaceId?): Promise<void>` |

### `lock_page`

Locks a currently unlocked protected page (clears session key).

| | Detail |
|---|---|
| **Rust** | `commands::page::lock_page(state, page_id)` |
| **Parameters** | `page_id: PageId` |
| **Returns** | `()` |
| **TS** | `lockPage(pageId): Promise<void>` |

### `import_pdf`

Imports a PDF file as an asset for a section.

| | Detail |
|---|---|
| **Rust** | `commands::page::import_pdf(state, section_id, file_path)` |
| **Parameters** | `section_id: SectionId`, `file_path: String` — absolute path |
| **Returns** | `(String, String, u32)` — (relative asset path, absolute path, total pages) |
| **Errors** | File not found, I/O |
| **TS** | `importPdf(sectionId, filePath): Promise<[string, string, number]>` |

### `create_pdf_canvas_page`

Creates a new page of type `pdf_canvas` with an already-imported PDF.

| | Detail |
|---|---|
| **Rust** | `commands::page::create_pdf_canvas_page(state, section_id, title, pdf_asset, pdf_total_pages)` |
| **Parameters** | `section_id: SectionId`, `title: String`, `pdf_asset: String` (absolute path), `pdf_total_pages: u32` |
| **Returns** | `Page` — created page with `editor_mode: PdfCanvas` |
| **Errors** | Section not found, I/O |
| **TS** | `createPdfCanvasPage(sectionId, title, pdfAsset, pdfTotalPages): Promise<Page>` |

### `update_page_annotations`

Saves the ink stroke annotations for a PDF Canvas page.

| | Detail |
|---|---|
| **Rust** | `commands::page::update_page_annotations(state, page_id, annotations)` |
| **Parameters** | `page_id: PageId`, `annotations: PageAnnotations` |
| **Returns** | `()` |
| **Errors** | Page not found, I/O |
| **TS** | `updatePageAnnotations(pageId, annotations): Promise<void>` |

### `create_canvas_page`

Creates a blank canvas page (freehand drawing without a PDF).

| | Detail |
|---|---|
| **Rust** | `commands::page::create_canvas_page(state, section_id, title)` |
| **Parameters** | `section_id: SectionId`, `title: String` |
| **Returns** | `Page` |
| **TS** | `createCanvasPage(sectionId, title): Promise<Page>` |

### `read_file_content`

Reads a file's content as text.

| | Detail |
|---|---|
| **Rust** | `commands::page::read_file_content(path)` |
| **Parameters** | `path: String` — absolute path |
| **Returns** | `String` |
| **TS** | `readFileContent(path): Promise<string>` |

### `save_file_content`

Writes content to a file.

| | Detail |
|---|---|
| **Rust** | `commands::page::save_file_content(path, content)` |
| **Parameters** | `path: String`, `content: String` |
| **Returns** | `()` |
| **TS** | `saveFileContent(path, content): Promise<void>` |

---

## Assets (4 commands)

### `import_asset`

Imports a file as a section asset (copy).

| | Detail |
|---|---|
| **Rust** | `commands::assets::import_asset(state, section_id, file_path)` |
| **Parameters** | `section_id: SectionId`, `file_path: String` |
| **Returns** | `AssetResult { asset_path: String }` — relative path |
| **TS** | `importAsset(sectionId, filePath)` |

### `import_asset_from_bytes`

Imports an asset from raw bytes (e.g. clipboard paste).

| | Detail |
|---|---|
| **Rust** | `commands::assets::import_asset_from_bytes(state, section_id, bytes, extension)` |
| **Parameters** | `section_id: SectionId`, `bytes: Vec<u8>`, `extension: String` |
| **Returns** | `AssetResult { asset_path: String }` |
| **TS** | `importAssetFromBytes(sectionId, bytes, extension)` |

### `read_asset_base64`

Reads an asset file and returns its content as a Base64 string.

| | Detail |
|---|---|
| **Rust** | `commands::assets::read_asset_base64(file_path)` |
| **Parameters** | `file_path: String` — absolute path |
| **Returns** | `String` — Base64-encoded content |
| **TS** | `readAssetBase64(filePath): Promise<string>` |

### `delete_asset`

Removes an asset from the filesystem.

| | Detail |
|---|---|
| **Rust** | `commands::assets::delete_asset(state, asset_path)` |
| **Parameters** | `asset_path: String` — relative path |
| **Returns** | `()` |
| **TS** | `deleteAsset(assetPath)` |

---

## Tags (1 command)

### `list_all_tags`

Lists all tags across all pages in the workspace (sorted, unique).

| | Detail |
|---|---|
| **Rust** | `commands::tags::list_all_tags(state)` |
| **Parameters** | — |
| **Returns** | `Vec<String>` |
| **TS** | `listAllTags(): Promise<string[]>` |

---

## Trash (4 commands)

### `list_trash_items`

Lists items in the trash.

| | Detail |
|---|---|
| **Rust** | `commands::trash::list_trash_items(state)` |
| **Parameters** | — |
| **Returns** | `Vec<TrashItem>` |
| **TS** | `listTrashItems(): Promise<TrashItem[]>` |

### `restore_from_trash`

Restores an item from the trash to its original location.

| | Detail |
|---|---|
| **Rust** | `commands::trash::restore_from_trash(state, trash_item_id)` |
| **Parameters** | `trash_item_id: String` |
| **Returns** | `()` |
| **Errors** | `TrashItemNotFound` |
| **TS** | `restoreFromTrash(trashItemId): Promise<void>` |

### `permanently_delete`

Permanently removes an item from the trash.

| | Detail |
|---|---|
| **Rust** | `commands::trash::permanently_delete(state, trash_item_id)` |
| **Parameters** | `trash_item_id: String` |
| **Returns** | `()` |
| **Errors** | `TrashItemNotFound` |
| **TS** | `permanentlyDelete(trashItemId): Promise<void>` |

### `empty_trash`

Empties the entire trash.

| | Detail |
|---|---|
| **Rust** | `commands::trash::empty_trash(state)` |
| **Parameters** | — |
| **Returns** | `()` |
| **TS** | `emptyTrash(): Promise<void>` |

---

## Search (6 commands)

### `search_pages`

Full-text search across all indexed pages.

| | Detail |
|---|---|
| **Rust** | `commands::search::search_pages(state, query)` |
| **Parameters** | `query: SearchQuery` — `{ query: String, notebook_id?: String, section_id?: String, limit?: usize }` |
| **Returns** | `SearchResults` — `{ items: Vec<SearchResultItem>, total: u64 }` |
| **TS** | `searchPages(query): Promise<SearchResults>` |

### `quick_open`

Fast title search for the QuickOpen dialog (`Cmd+P`).

| | Detail |
|---|---|
| **Rust** | `commands::search::quick_open(state, query, limit)` |
| **Parameters** | `query: String`, `limit?: usize` (default 10) |
| **Returns** | `Vec<SearchResultItem>` |
| **TS** | `quickOpen(query, limit?): Promise<SearchResultItem[]>` |

### `reindex_page`

Re-indexes a specific page in the search engine.

| | Detail |
|---|---|
| **Rust** | `commands::search::reindex_page(state, page_id)` |
| **Parameters** | `page_id: PageId` |
| **Returns** | `()` |
| **Effects** | Removes old document and inserts updated one in Tantivy |
| **TS** | `reindexPage(pageId): Promise<void>` |

### `rebuild_index`

Rebuilds the entire search index from scratch.

| | Detail |
|---|---|
| **Rust** | `commands::search::rebuild_index(state)` |
| **Parameters** | — |
| **Returns** | `u64` — total pages indexed |
| **Effects** | Iterates all notebooks → sections → pages, re-indexes everything |
| **TS** | `rebuildIndex(): Promise<number>` |

### `get_index_status`

Returns the current search index status.

| | Detail |
|---|---|
| **Rust** | `commands::search::get_index_status(state)` |
| **Parameters** | — |
| **Returns** | `IndexStatus` — `{ total_docs: u64, index_size_bytes: u64 }` |
| **TS** | `getIndexStatus(): Promise<IndexStatus>` |

### `search_all_workspaces`

Full-text search across all currently open workspaces.

| | Detail |
|---|---|
| **Rust** | `commands::search::search_all_workspaces(state, query)` |
| **Parameters** | `query: SearchQuery` |
| **Returns** | `SearchResults` |
| **TS** | `searchAllWorkspaces(query): Promise<SearchResults>` |

---

## Sync (17 commands)

### `get_sync_providers`

Lists available sync providers with their connection status.

| | Detail |
|---|---|
| **Rust** | `commands::sync::get_sync_providers(state)` |
| **Parameters** | — |
| **Returns** | `Vec<ProviderInfo>` — `{ name, display_name, connected, user_email?, last_synced_at? }` |
| **TS** | `getSyncProviders(): Promise<ProviderInfo[]>` |

### `get_sync_status`

Returns the current synchronization status.

| | Detail |
|---|---|
| **Rust** | `commands::sync::get_sync_status(state)` |
| **Parameters** | — |
| **Returns** | `SyncStatus` — `{ is_syncing, provider?, progress?, last_synced_at?, last_error?, pending_conflicts }` |
| **TS** | `getSyncStatus(): Promise<SyncStatus>` |

### `get_sync_config`

Returns the current sync configuration.

| | Detail |
|---|---|
| **Rust** | `commands::sync::get_sync_config(state)` |
| **Parameters** | — |
| **Returns** | `SyncPreferences` — `{ enabled, provider?, interval_seconds, synced_notebook_ids }` |
| **TS** | `getSyncConfig(): Promise<SyncPreferences>` |

### `set_sync_config`

Updates the sync configuration.

| | Detail |
|---|---|
| **Rust** | `commands::sync::set_sync_config(state, config)` |
| **Parameters** | `config: SyncPreferences` |
| **Returns** | `()` |
| **Errors** | Sync coordinator not initialized |
| **Effects** | If `provider` is set, creates a provider instance |
| **TS** | `setSyncConfig(config): Promise<void>` |

### `get_sync_conflicts`

Lists pending sync conflicts.

| | Detail |
|---|---|
| **Rust** | `commands::sync::get_sync_conflicts(state)` |
| **Parameters** | — |
| **Returns** | `Vec<SyncConflict>` |
| **TS** | `getSyncConflicts(): Promise<SyncConflict[]>` |

### `resolve_sync_conflict`

Resolves a specific sync conflict.

| | Detail |
|---|---|
| **Rust** | `commands::sync::resolve_sync_conflict(state, conflict_id, resolution)` |
| **Parameters** | `conflict_id: String`, `resolution: ConflictResolution` (`keep_local`, `keep_remote`, `keep_both`) |
| **Returns** | `()` |
| **Errors** | Conflict not found, sync coordinator not initialized |
| **TS** | `resolveSyncConflict(conflictId, resolution): Promise<void>` |

### `get_provider_status`

Returns the connection status for all known providers (without requiring an open workspace).

| | Detail |
|---|---|
| **Rust** | `commands::sync::get_provider_status()` |
| **Parameters** | — |
| **Returns** | `Vec<ProviderConnectionStatus>` |
| **TS** | `getProviderStatus(): Promise<ProviderConnectionStatus[]>` |

### `connect_provider`

Initiates the OAuth2 authentication flow for a provider.

| | Detail |
|---|---|
| **Rust** | `commands::sync::connect_provider(state, provider_name)` |
| **Parameters** | `provider_name: String` (`"google_drive"`, `"onedrive"`, `"dropbox"`) |
| **Returns** | `ProviderInfo` |
| **Effects** | Opens browser for OAuth2 PKCE flow, stores token on success |
| **TS** | `connectProvider(providerName): Promise<ProviderInfo>` |

### `disconnect_provider`

Disconnects and removes a provider's auth token.

| | Detail |
|---|---|
| **Rust** | `commands::sync::disconnect_provider(state, provider_name)` |
| **Parameters** | `provider_name: String` |
| **Returns** | `()` |
| **TS** | `disconnectProvider(providerName): Promise<void>` |

### `disconnect_provider_by_name`

Disconnects a provider by name (stateless, does not require an open workspace).

| | Detail |
|---|---|
| **Rust** | `commands::sync::disconnect_provider_by_name(provider_name)` |
| **Parameters** | `provider_name: String` |
| **Returns** | `()` |
| **TS** | `disconnectProviderByName(providerName): Promise<void>` |

### `sync_initial_upload`

Uploads the entire workspace to the cloud for the first time.

| | Detail |
|---|---|
| **Rust** | `commands::sync::sync_initial_upload(state, provider_name)` |
| **Parameters** | `provider_name: String` |
| **Returns** | `()` |
| **Effects** | Uploads all workspace files, writes sync manifest |
| **TS** | `syncInitialUpload(providerName): Promise<void>` |

### `sync_bidirectional`

Performs a full bidirectional sync (upload local changes, download remote changes).

| | Detail |
|---|---|
| **Rust** | `commands::sync::sync_bidirectional(state, provider_name)` |
| **Parameters** | `provider_name: String` |
| **Returns** | `()` |
| **Effects** | Detects local/remote changes via SHA-256 manifest, resolves conflicts |
| **TS** | `syncBidirectional(providerName): Promise<void>` |

### `list_remote_workspaces`

Lists workspaces available in the cloud for a given provider.

| | Detail |
|---|---|
| **Rust** | `commands::sync::list_remote_workspaces(state, provider_name)` |
| **Parameters** | `provider_name: String` |
| **Returns** | `Vec<RemoteWorkspace>` — `{ name, path, last_modified }` |
| **TS** | `listRemoteWorkspaces(providerName): Promise<RemoteWorkspace[]>` |

### `download_workspace`

Downloads a remote workspace to a local directory.

| | Detail |
|---|---|
| **Rust** | `commands::sync::download_workspace(state, provider_name, remote_path, local_path)` |
| **Parameters** | `provider_name: String`, `remote_path: String`, `local_path: String` |
| **Returns** | `()` |
| **Effects** | Downloads all workspace files, creates local directory structure |
| **TS** | `downloadWorkspace(providerName, remotePath, localPath): Promise<void>` |

### `list_downloaded_workspaces`

Lists workspaces that have been downloaded from the cloud and are available locally.

| | Detail |
|---|---|
| **Rust** | `commands::sync::list_downloaded_workspaces()` |
| **Parameters** | — |
| **Returns** | `Vec<DownloadedWorkspace>` |
| **TS** | `listDownloadedWorkspaces(): Promise<DownloadedWorkspace[]>` |

### `get_opennote_dir`

Returns the path to the `~/.opennote` configuration directory.

| | Detail |
|---|---|
| **Rust** | `commands::sync::get_opennote_dir()` |
| **Parameters** | — |
| **Returns** | `String` — absolute path |
| **TS** | `getOpennoteDir(): Promise<string>` |

### `get_default_sync_dir`

Returns the default local directory used for downloaded workspaces.

| | Detail |
|---|---|
| **Rust** | `commands::sync::get_default_sync_dir()` |
| **Parameters** | — |
| **Returns** | `String` — absolute path |
| **TS** | `getDefaultSyncDir(): Promise<string>` |

---

## Template (4 commands)

### `list_templates`

Lists all saved page templates for the workspace.

| | Detail |
|---|---|
| **Rust** | `commands::template::list_templates(state)` |
| **Parameters** | — |
| **Returns** | `Vec<PageTemplate>` |
| **TS** | `listTemplates(): Promise<PageTemplate[]>` |

### `create_template_from_page`

Creates a new template from an existing page.

| | Detail |
|---|---|
| **Rust** | `commands::template::create_template_from_page(state, page_id, template_name)` |
| **Parameters** | `page_id: PageId`, `template_name: String` |
| **Returns** | `PageTemplate` |
| **TS** | `createTemplateFromPage(pageId, templateName): Promise<PageTemplate>` |

### `delete_template`

Deletes a page template.

| | Detail |
|---|---|
| **Rust** | `commands::template::delete_template(state, template_id)` |
| **Parameters** | `template_id: String` |
| **Returns** | `()` |
| **TS** | `deleteTemplate(templateId): Promise<void>` |

### `create_page_from_template`

Creates a new page in a section using a template.

| | Detail |
|---|---|
| **Rust** | `commands::template::create_page_from_template(state, section_id, template_id)` |
| **Parameters** | `section_id: SectionId`, `template_id: String` |
| **Returns** | `Page` |
| **TS** | `createPageFromTemplate(sectionId, templateId): Promise<Page>` |

---

## Spellcheck (1 command)

### `check_spelling`

Checks text for spelling and grammar errors via LanguageTool.

| | Detail |
|---|---|
| **Rust** | `commands::spellcheck::check_spelling(request)` |
| **Parameters** | `request: SpellCheckRequest` — `{ text: String, language: String }` |
| **Returns** | `SpellCheckResponse` — list of matches with suggestions |
| **TS** | `checkSpelling(request): Promise<SpellCheckResponse>` |

---

## Referenced Types

For complete type definitions used in commands, see:

- [DATA_MODEL.md](./DATA_MODEL.md) — Entities, value objects, enums
- `src/types/bindings/` — Auto-generated TypeScript bindings
- `src/types/search.ts` — Search types
- `src/types/sync.ts` — Sync types

---

## Usage Patterns

### Typical IPC command flow

```typescript
// Frontend (src/lib/ipc.ts)
export const createNotebook = (name: string) =>
  invoke<Notebook>("create_notebook", { name });

// Called from a store
const notebook = await ipc.createNotebook("Study Notes");
```

```rust
// Backend (src-tauri/src/commands/notebook.rs)
#[tauri::command]
pub fn create_notebook(state: State<AppManagedState>, name: String) -> Result<Notebook, String> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::create_notebook(&root, &name).map_err(|e| e.to_string())
}
```

### Argument serialization

Tauri automatically converts between `camelCase` (JS) and `snake_case` (Rust):
- Frontend sends: `{ notebookId: "abc-123" }`
- Rust receives: `notebook_id: NotebookId`

### Error handling

All commands return `Result<T, String>`. The frontend handles errors via try/catch:

```typescript
try {
  await ipc.createNotebook("Study Notes");
} catch (error) {
  toast.error(t('errors.notebookAlreadyExists'));
}
```

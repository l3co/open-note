# System Design — Open Note

Central design document. Covers vision, principles, architecture, concurrency model, persistence, search, sync, and security.

---

## 1. Overview

**Open Note** is a **local-first** desktop note-taking application inspired by Microsoft OneNote.

### Problem

Popular note-taking apps (OneNote, Notion, Evernote) store data on proprietary servers, require accounts, collect telemetry, and lock users into closed formats. Users have no real control over their data.

### Solution

A desktop application that:
- Stores data on the **local filesystem** in an open format (JSON)
- Works **100% offline** — no server required
- Offers **optional sync** with cloud providers (Google Drive, OneDrive, Dropbox)
- Supports **rich text**, **Markdown**, **handwriting/ink**, **PDF**, and **full-text search**
- Runs on **macOS, Windows, and Linux** (future: Android/iOS via Tauri v2)

### Product Principles

| Principle | Technical implication |
|---|---|
| **Local-first** | Data on the filesystem. App works offline. Sync is opt-in. |
| **Open format** | Human-readable JSON (`.opn.json`). No proprietary format. |
| **No telemetry** | Zero tracking. No mandatory account. |
| **Extensible** | Block architecture allows new types without rewriting the editor. |
| **Lightweight** | ~5MB binary via Tauri (vs ~150MB Electron). |

---

## 2. High-Level Architecture

The system is divided into **3 main layers** with dependencies pointing inward (Clean Architecture):

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (WebView)                      │
│  React 19 + TypeScript + TailwindCSS v4 + Zustand         │
│  TipTap (rich text) · CodeMirror (markdown) · Canvas (ink) │
├──────────────────────────────────────────────────────────┤
│                    Tauri IPC Bridge                        │
│              ~50 typed commands (Rust ↔ TS)                │
├──────────────────────────────────────────────────────────┤
│                    Backend (Rust)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Core    │  │ Storage  │  │  Search  │  │   Sync   │ │
│  │ (domain) │  │(filesys.)│  │(Tantivy) │  │ (cloud)  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└──────────────────────────────────────────────────────────┘
         │                                    │
    Local Filesystem                    Cloud APIs
    (~/OpenNote/)               (GDrive/OneDrive/Dropbox)
```

### Dependency rule

```
Frontend (React) ──invoke()──→ src-tauri (IPC) ──→ crates/storage ──→ crates/core
                                                ──→ crates/search  ──→ crates/core
                                                ──→ crates/sync    ──→ crates/core
```

- **`crates/core`** — Pure domain. Zero framework dependencies. No Tauri, filesystem, HTTP, or UI.
- **`crates/storage`** — Persistence infrastructure. Depends on `core`. Atomic writes, lock, trash, assets, migrations.
- **`crates/search`** — Search engine. Depends on `core`. Tantivy, custom tokenizer, text extraction.
- **`crates/sync`** — Cloud sync. Depends on `core`. Provider trait, SHA-256 manifest, change detection.
- **`src-tauri`** — **Thin** IPC layer. Parse args → call crate → serialize response. No business logic.

---

## 3. Domain Model

### Content hierarchy

```
Workspace (1)
 └── Notebook (N)
      └── Section (N)
           └── Page (N)
                ├── Block[] (N) — structural content
                └── PageAnnotations — annotation layer (ink overlay, highlights)
```

### Core entities

| Entity | Identifier | Persistence | Business rules |
|---|---|---|---|
| **Workspace** | `WorkspaceId(Uuid)` | `workspace.json` at root | Non-empty name, trimmed |
| **Notebook** | `NotebookId(Uuid)` | `notebook.json` in directory | Non-empty name, order, optional color/icon |
| **Section** | `SectionId(Uuid)` | `section.json` in directory | Non-empty name, belongs to a notebook |
| **Page** | `PageId(Uuid)` | `{slug}.opn.json` | Non-empty title, soft limit 200 blocks, hard limit 500 |
| **Block** | `BlockId(Uuid)` | Inline in `.opn.json` | Tagged union with 11 variants, explicit order |

### Block as Tagged Union

Blocks use `#[serde(tag = "type", rename_all = "snake_case")]` for polymorphic serialization:

```json
{
  "type": "text",
  "id": "uuid",
  "order": 0,
  "content": { "tiptap_json": { } }
}
```

This allows the frontend to identify the type via `block.type` and render the correct component.

> See [GLOSSARY.md](./GLOSSARY.md) for the complete list of block types and their definitions.

---

## 4. Persistence Model

### Filesystem structure

```
~/.opennote/                       # Global state (outside workspaces)
  └── app_state.json               # Recent workspaces, theme, language

~/OpenNote/                        # Workspace root (example)
  ├── workspace.json               # Workspace metadata
  ├── .lock                        # Process lock (PID)
  ├── .trash/                      # Trash (soft-delete)
  │    ├── trash_manifest.json
  │    └── {uuid}/                 # Preserved items
  ├── .opennote/                   # Derived data
  │    ├── index/                  # Tantivy index
  │    └── sync_manifest.json      # SHA-256 hashes for sync
  └── my-notebook/                 # Notebook (directory)
       ├── notebook.json
       └── notes/                  # Section (directory)
            ├── section.json
            ├── my-page.opn.json   # Page
            └── assets/            # Images, PDFs, SVGs
```

### Atomic Writes

Every file write follows this pattern:

1. Serialize to JSON
2. Write to temporary file (`{path}.tmp`)
3. `fsync()` the temporary file
4. Atomic `rename()` to the final path
5. `fsync()` the parent directory

This guarantees the file is never in a corrupted state, even with a crash or power loss.

### Schema Versioning

Each `.opn.json` contains `schema_version: N`. When the format evolves:

1. Code increments `CURRENT_SCHEMA_VERSION`
2. Migration function `fn migrate_vN_to_vM(Value) -> Value` is added
3. On read, if `schema_version < CURRENT_SCHEMA_VERSION`, migrations are applied in sequence
4. Page is re-saved with the current version

Migrations are **pure functions** — they receive JSON (`serde_json::Value`) and return JSON. No side effects.

### Slug Generation

Page filenames are generated via slug:

1. Unicode normalization (NFD → NFC)
2. Lowercase
3. Special characters → hyphen
4. Multiple hyphens → one
5. Collision detection → numeric suffix (`my-page-2.opn.json`)

---

## 5. Concurrency Model

### Workspace Lock

When opening a workspace, the app creates `.lock` containing the process PID:

- If `.lock` exists and the PID is active → `WorkspaceLocked` error
- If `.lock` exists and the PID is not active → stale lock, removed automatically
- When closing the workspace → `.lock` is removed

Prevents two app instances from corrupting the same workspace.

### SaveCoordinator (per-Page Mutex)

The backend maintains a `HashMap<PageId, Mutex<()>>` to serialize writes to the same page:

```rust
pub struct SaveCoordinator {
    page_locks: Mutex<HashMap<PageId, Arc<Mutex<()>>>>,
}
```

**Save flow (read-modify-write):**

1. Frontend sends `update_page_blocks(page_id, blocks)`
2. SaveCoordinator acquires the page lock
3. Reads current page from filesystem
4. Replaces blocks
5. Writes via atomic write
6. Releases lock

This prevents race conditions when multiple saves arrive in rapid succession (e.g., auto-save + manual save).

### AppManagedState

Shared backend state, managed by Tauri. Holds up to 10 open `WorkspaceContext` instances:

```rust
pub struct AppManagedState {
    contexts: Mutex<HashMap<WorkspaceId, WorkspaceContext>>,
    save_coordinator: SaveCoordinator,
    focused_workspace: Mutex<Option<WorkspaceId>>,
}
```

Each `WorkspaceContext` contains its own `SearchEngine` and `SyncCoordinator`. Resources are initialized on demand (e.g., `SearchEngine` only exists after opening a workspace).

---

## 6. Search Model

### Tantivy (Full-Text Search)

The `SearchEngine` uses Tantivy with:

**Schema:**
| Field | Type | Boost | Tokenizer |
|---|---|---|---|
| `page_id` | Stored | — | — |
| `title` | Text | 2.0 | opennote |
| `content` | Text | 1.0 | opennote |
| `tags` | Text | 1.5 | opennote |
| `notebook_name` | Text | 1.0 | opennote |
| `section_name` | Text | 1.0 | opennote |
| `notebook_id` | Stored | — | — |
| `section_id` | Stored | — | — |
| `updated_at` | Date | — | — |
| `created_at` | Date | — | — |

**Custom tokenizer "opennote":**
```
SimpleTokenizer → RemoveLongFilter → LowerCaser → AsciiFoldingFilter
```

`AsciiFoldingFilter` allows searching "cafe" to match "café" — essential for accented content.

### Indexing

- **Incremental:** Each page save calls `index_page()` which removes the previous document and inserts the new one.
- **Text extraction:** Text is extracted from all block types (text, markdown, code, checklist, table, image alt, callout, embed). Ink, PDF, and divider are ignored.
- **Rebuild:** `rebuild_index()` re-indexes all pages in the workspace. Used for recovery.
- **Consistency:** `reader.reload()` is called after each commit to ensure searches return results immediately.

### Two search interfaces

| Interface | Shortcut | Use | Engine method |
|---|---|---|---|
| **QuickOpen** | Cmd+P | Search by title | `quick_open(query)` |
| **SearchPanel** | Cmd+Shift+F | Full-text with snippets | `search(SearchQuery)` |

---

## 7. Sync Model

### Principle: Local-First, Cloud-Aware

```
Local Workspace ←──sync──→ Cloud Provider
    (always)                  (opt-in)
```

Sync is never mandatory. Disconnecting never deletes data (both copies remain).

### Provider Trait

```rust
#[async_trait]
pub trait SyncProvider {
    async fn authenticate(&self) -> Result<AuthToken, SyncError>;
    async fn list_files(&self, path: &str) -> Result<Vec<RemoteFile>, SyncError>;
    async fn upload_file(&self, local: &Path, remote: &str) -> Result<(), SyncError>;
    async fn download_file(&self, remote: &str, local: &Path) -> Result<(), SyncError>;
    async fn delete_file(&self, remote: &str) -> Result<(), SyncError>;
    async fn create_directory(&self, remote: &str) -> Result<(), SyncError>;
}
```

Three providers implemented: `GoogleDriveProvider`, `OneDriveProvider`, `DropboxProvider`. Each implements OAuth2 PKCE flow. Requires credentials to be configured at build time — see [DEVELOPMENT.md — OAuth Credentials](./DEVELOPMENT.md#9-oauth-credentials).

### Change Detection

The `SyncManifest` persists SHA-256 hashes of each synced file. On comparison:

| Local | Manifest | Remote | Result |
|---|---|---|---|
| Exists | Not in manifest | — | `LocalOnly` → upload |
| — | In manifest | Exists | `RemoteOnly` → download |
| Hash ≠ manifest | — | Hash = manifest | `LocalModified` → upload |
| Hash = manifest | — | Hash ≠ manifest | `RemoteModified` → download |
| Hash ≠ manifest | — | Hash ≠ manifest | `BothModified` → conflict |
| Does not exist | In manifest | — | `LocalDeleted` |

### Conflict Resolution

3 strategies:
- **KeepLocal** — local version overwrites remote
- **KeepRemote** — remote version overwrites local
- **KeepBoth** — creates a copy with a suffix (e.g., `page-conflict-2026-03-09.opn.json`)

---

## 8. Frontend — State Management

### Zustand Stores

| Store | Responsibility | Data |
|---|---|---|
| `useWorkspaceStore` | Workspace, notebooks, sections CRUD (facade over multi-workspace) | workspace, notebooks[], sections[] |
| `useMultiWorkspaceStore` | Multi-workspace management, IPC delegation | contexts[], focusedWorkspaceId |
| `useNavigationStore` | Selection, expand/collapse, history | selectedNotebook/Section/Page, history[] |
| `usePageStore` | Page CRUD, save status | currentPage, saveStatus |
| `useUIStore` | Sidebar, theme, modals, search/sync panels | sidebarOpen, theme, showSettings, etc. |

### Data Flow (unidirectional)

```
User Action → Store Action → IPC invoke() → Rust Backend → Filesystem
                                                    ↓
                                              Result/Error
                                                    ↓
                                         Store Update → React Re-render
```

### Serialization Layer

The frontend maintains a serialization layer between the domain (`Block[]`) and the editor (TipTap `JSONContent`):

- **`blocksToTiptap(blocks)`** — Converts `Block[]` to TipTap `JSONContent`. `TextBlock`s become TipTap nodes. `DividerBlock`s become `horizontalRule`. Non-text blocks are preserved outside TipTap.
- **`tiptapToBlocks(doc, existingBlocks)`** — Converts back, preserving IDs and non-text blocks.

---

## 9. Editor Architecture

### Dual-Mode Editor

Each page can be edited in 2 modes, toggled via `Cmd+Shift+M`:

| Mode | Engine | Use |
|---|---|---|
| **RichText** | TipTap v3 (ProseMirror) | WYSIWYG with floating toolbar and slash commands |
| **Markdown** | CodeMirror 6 | Raw editing with syntax highlighting |

Conversion between modes uses the serialization layer:
```
RichText Mode ←→ TipTap JSON ←→ Block[] ←→ Markdown string ←→ Markdown Mode
```

### Auto-Save

```
User types → TipTap onChange → tiptapToBlocks() → useAutoSave (debounce 1s) → IPC update_page_blocks
```

The `useAutoSave` hook:
- Configurable debounce (default 1s via `WorkspaceSettings.auto_save_interval_ms`)
- `forceSave()` for immediate flush (e.g., before navigating to another page)
- Cleanup on unmount (flushes pending save)
- `enabled` flag to temporarily disable

---

## 10. Theme System (3 Layers)

### Layer 1 — Base Theme
Defines background, text, border, and surface colors:

| Theme | Style |
|---|---|
| `light` | Clean white |
| `paper` | Cream / sepia |
| `dark` | Deep dark |
| `system` | Follows the OS |

Applied via `<html data-theme="dark">`.

### Layer 2 — Accent Color
10 palettes with 4 variants each: `base`, `hover`, `subtle` (10% opacity), `onAccent` (text).

Palettes: Blue, Indigo, Purple, Berry, Red, Orange, Amber, Green, Teal, Graphite.

### Layer 3 — Chrome Tint
Defines the tint of the sidebar and toolbar:

| Tint | Effect |
|---|---|
| `neutral` | Neutral gray |
| `tinted` | Accent color tint via `color-mix()` |

Applied via `<html data-chrome="tinted">`.

**Persistence:** `GlobalSettings.theme → ThemeConfig { base_theme, accent_color, chrome_tint }` — stored in `~/.opennote/app_state.json`.

---

## 11. Internationalization (i18n)

- **Engine:** react-i18next
- **Languages:** pt-BR (default), en
- **Keys:** 250+ translated strings
- **Switching:** No restart — `i18n.changeLanguage()` re-renders everything
- **Rule:** No visible string hardcoded. Everything via `t('key')`.
- **Backend errors:** Backend returns error codes (e.g., `NOTEBOOK_ALREADY_EXISTS`). Frontend translates via i18n.

---

## 12. Security

| Aspect | Implementation |
|---|---|
| **No telemetry** | Zero tracking, zero analytics, zero phone-home |
| **No account** | App works without any authentication |
| **Tauri Capabilities** | Granular permissions per window (`capabilities/default.json`) |
| **Workspace Lock** | `.lock` with PID prevents corruption from concurrent access |
| **Atomic Writes** | Writes never corrupt an existing file |
| **No eval/exec** | Frontend does not execute dynamic code |
| **OAuth2** | Sync tokens stored locally, never transmitted to third parties |
| **Local data** | No intermediary server. Sync is direct app ↔ cloud provider |

---

## 13. Limits and Trade-offs

| Aspect | Limit | Reason |
|---|---|---|
| **Blocks per page** | Soft 200, Hard 500 | Editor performance. Virtualization is future work. |
| **Recent workspaces** | Maximum 10 | UX — manageable list |
| **Trash retention** | 30 days | Disk space |
| **Sync** | File-level, not block-level | Simplicity. CRDT is future work. |
| **PDF** | Render only (no editing) | v1 scope. pdfjs is read-only. |
| **Mobile** | Not supported (v1) | Tauri v2 supports it, but scope is desktop. |
| **Global undo** | No cross-page undo | v1 limitation. Trash mitigates the critical case. |
| **Real-time collab** | Not available | Out of scope. Requires CRDT/OT. |

---

## 14. Architecture Decision Records (ADRs)

Decisions formally recorded in `docs/adr/`:

| ADR | Decision |
|---|---|
| [001](./adr/001-tauri-v2.md) | Tauri v2 as the desktop runtime |
| [002](./adr/002-cargo-workspace.md) | Cargo workspace with bounded-context crates |
| [003](./adr/003-tiptap-editor.md) | TipTap v3 as the rich text editor |
| [004](./adr/004-tantivy-search.md) | Tantivy as the local search engine |
| [005](./adr/005-zustand-state.md) | Zustand for state management |
| [006](./adr/006-theme-system.md) | Three-layer theme system |
| [007](./adr/007-local-first.md) | Local-first, cloud-aware strategy |
| [008](./adr/008-ink-hybrid.md) | Hybrid ink (Overlay + Block) |
| [009](./adr/009-i18n-strategy.md) | react-i18next for i18n |

---

## 15. Related Documents

| Document | Content |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Mermaid diagrams (C4, sequence, ER, state) |
| [DATA_MODEL.md](./DATA_MODEL.md) | Detailed data model with JSON schemas |
| [IPC_REFERENCE.md](./IPC_REFERENCE.md) | Complete IPC command reference |
| [GLOSSARY.md](./GLOSSARY.md) | DDD glossary — ubiquitous language |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Development guide |
| [TESTING.md](./TESTING.md) | Test strategy |

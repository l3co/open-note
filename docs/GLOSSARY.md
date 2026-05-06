# Glossary — Open Note Ubiquitous Language

This glossary formalizes the domain terms (DDD) used in the code, documentation, and project communication. All developers should use these terms consistently.

---

## Content Hierarchy

| Term | Definition | Rust type | File |
|---|---|---|---|
| **Workspace** | Top-level container. Maps to a directory on the filesystem containing notebooks, settings, and derived data. A user can have multiple workspaces. | `Workspace` | `crates/core/src/workspace.rs` |
| **Notebook** | Grouping within a workspace. Equivalent to a "notebook" in OneNote. Maps to a subdirectory of the workspace. Has a name, color, icon, and order. | `Notebook` | `crates/core/src/notebook.rs` |
| **Section** | Subdivision of a notebook. Equivalent to a "tab" or "section" in OneNote. Maps to a subdirectory of the notebook. Contains pages and an `assets/` directory. | `Section` | `crates/core/src/section.rs` |
| **Page** | Individual document within a section. Persisted as an `.opn.json` file. Contains blocks, annotations, tags, and editor preferences. | `Page` | `crates/core/src/page.rs` |
| **Block** | Atomic unit of content within a page. Tagged union with 11 variants (text, code, checklist, table, image, ink, pdf, divider, callout, embed, markdown). Each block has an ID, order, and timestamps. | `Block` (enum) | `crates/core/src/block.rs` |

### Hierarchical relationship

```
Workspace (1) → Notebook (N) → Section (N) → Page (N) → Block (N)
```

---

## Block Types

| Type | JSON tag | Description | Rust struct |
|---|---|---|---|
| **TextBlock** | `"text"` | Rich text stored as TipTap JSON (`content.tiptap_json`). Headings, paragraphs, lists, inline formatting. | `TextBlock` |
| **MarkdownBlock** | `"markdown"` | Raw Markdown content as a string. | `MarkdownBlock` |
| **CodeBlock** | `"code"` | Code block with optional language tag and syntax highlighting. | `CodeBlock` |
| **ChecklistBlock** | `"checklist"` | List of items with checkboxes (`ChecklistItem { text, checked }`). | `ChecklistBlock` |
| **TableBlock** | `"table"` | Table as `Vec<Vec<String>>` with a `has_header` flag. | `TableBlock` |
| **ImageBlock** | `"image"` | Reference to a local asset (`src`), with alt text and optional dimensions. | `ImageBlock` |
| **InkBlock** | `"ink"` | Freehand drawing / handwriting. Isolated canvas with strokes and fixed dimensions. | `InkBlock` |
| **PdfBlock** | `"pdf"` | PDF document rendered via pdf.js. Reference to asset with total page count. | `PdfBlock` |
| **DividerBlock** | `"divider"` | Horizontal visual separator. No additional content. | `DividerBlock` |
| **CalloutBlock** | `"callout"` | Highlight box with variant (`info`, `warning`, `error`, `success`, `tip`) and text. | `CalloutBlock` |
| **EmbedBlock** | `"embed"` | Embedded content (URL, title, description, thumbnail). Links, videos, previews. | `EmbedBlock` |

---

## Annotations & Ink

| Term | Definition | Rust type |
|---|---|---|
| **PageAnnotations** | Container for a page's annotations: strokes (drawings), highlights (text markings), and SVG cache. | `PageAnnotations` |
| **AnchoredStroke** | Ink stroke anchored to a specific block (or absolute coordinates if the block was deleted). Contains points, color, size, tool, and opacity. | `AnchoredStroke` |
| **StrokeAnchor** | Anchor point of a stroke — block reference + X/Y offset + optional PDF page. | `StrokeAnchor` |
| **StrokePoint** | Individual point of a stroke with coordinates (x, y) and pressure. | `StrokePoint` |
| **HighlightAnnotation** | Text marking within a block, defined by character offsets (start/end) with color and opacity. | `HighlightAnnotation` |
| **InkTool** | Drawing tool: `pen`, `marker`, or `eraser`. | `InkTool` (enum) |
| **Ink Overlay** | Transparent Canvas layer over the page content that allows annotating on top of text/images. Strokes are anchored to DOM blocks. | — (frontend concept) |
| **Ink Block** | Dedicated block for freehand drawing, with an isolated canvas and fixed dimensions. Different from the Overlay. | `InkBlock` |

---

## Identity & Value Objects

| Term | Definition | Rust type |
|---|---|---|
| **Newtype ID** | Strong typing pattern for IDs. Each entity has its own type (`PageId`, `NotebookId`, etc.) wrapping a `Uuid`. Prevents accidental mixing of IDs between entities. | `define_id!` macro |
| **WorkspaceId** | Unique workspace ID. | `WorkspaceId(Uuid)` |
| **NotebookId** | Unique notebook ID. | `NotebookId(Uuid)` |
| **SectionId** | Unique section ID. | `SectionId(Uuid)` |
| **PageId** | Unique page ID. | `PageId(Uuid)` |
| **BlockId** | Unique block ID within a page. | `BlockId(Uuid)` |
| **StrokeId** | Unique stroke (ink trace) ID. | `StrokeId(Uuid)` |
| **AnnotationId** | Unique annotation (highlight) ID. | `AnnotationId(Uuid)` |
| **Color** | Value object for a validated hex color (`#rrggbb` or `#rgb`). | `Color` |
| **Slug** | String derived from a page title, used as the filename. Unicode normalization, special character removal, collision detection with numeric suffix. | `unique_slug()` |

---

## Persistence & Storage

| Term | Definition | Location |
|---|---|---|
| **`.opn.json`** | Page file format. Versioned JSON with blocks, annotations, tags, and metadata. | `crates/storage/` |
| **Schema Version** | Integer in the page JSON (`schema_version: 1`). Enables automatic migration when the format evolves. | `page.rs::CURRENT_SCHEMA_VERSION` |
| **Migration** | Pure function `fn migrate_vN_to_vM(Value) -> Value` that transforms JSON from one version to another. | `crates/storage/src/migrations.rs` |
| **Atomic Write** | write-to-tmp + rename + fsync pattern to guarantee files are never left in a corrupt state. | `crates/storage/src/atomic.rs` |
| **FsStorageEngine** | Filesystem persistence engine. Implements CRUD for all entities, trash, assets, and app state. Stateless struct (static methods). | `crates/storage/src/engine.rs` |
| **Workspace Lock** | `.lock` file with the process PID. Prevents concurrent access to the same workspace. Stale lock detection when the process no longer exists. | `crates/storage/src/lock.rs` |
| **AppState** | Global application state persisted in `~/.opennote/app_state.json`. Contains recent workspaces, global settings (theme, language), and window bounds. | `crates/core/src/settings.rs` |
| **Trash** | `.trash/` directory inside the workspace. Soft-delete with 30-day retention. `TrashManifest` tracks items. Expired items are removed automatically. | `crates/core/src/trash.rs` |
| **TrashManifest** | JSON file (`trash_manifest.json`) that lists all items in the trash with metadata (type, original title, path, dates, size). | `TrashManifest` |
| **Asset** | Binary file (image, PDF, ink SVG) associated with a section. Stored in `{section}/assets/`. Follows the page on move and delete operations. | `FsStorageEngine::import_asset` |

---

## Search & Indexing

| Term | Definition | Location |
|---|---|---|
| **SearchEngine** | Tantivy wrapper. Indexes pages with title (boost 2.0), content, tags (boost 1.5), notebook/section info. | `crates/search/src/engine.rs` |
| **Tantivy** | Full-text search engine written in Rust (similar to Lucene). Used for local indexing, no server required. | External dependency |
| **Custom Tokenizer** | "opennote" tokenizer registered in the index: `SimpleTokenizer → RemoveLongFilter → LowerCaser → AsciiFoldingFilter`. Allows searching "cafe" to match "café". | `crates/search/src/schema.rs` |
| **Text Extraction** | Process of extracting readable text from all block types for indexing. Ink, PDF, and divider are ignored. | `crates/search/src/extract.rs` |
| **QuickOpen** | Dialog (`Cmd+P`) for fast page title search. Uses `quick_open` from SearchEngine. | Frontend |
| **SearchPanel** | Side panel (`Cmd+Shift+F`) for full-text search with snippets and filters. | Frontend |
| **Snippet** | Text excerpt around the found term, displayed in search results. | `SearchEngine::search` |

---

## Cloud Sync

| Term | Definition | Location |
|---|---|---|
| **SyncProvider** | Async trait defining the interface for cloud providers: auth, list, upload, download, delete, create_directory. | `crates/sync/src/provider.rs` |
| **SyncCoordinator** | Workspace-scoped orchestrator. Manages providers, preferences, change detection, and conflict resolution. | `crates/sync/src/coordinator.rs` |
| **SyncManifest** | JSON file tracking SHA-256 hashes of synced files. Persisted at `.opennote/sync_manifest.json`. | `crates/sync/src/manifest.rs` |
| **FileChange** | Result of comparing a local file against its remote counterpart. Types: `LocalOnly`, `RemoteOnly`, `LocalModified`, `RemoteModified`, `BothModified`, `LocalDeleted`, `Unchanged`. | `FileChangeKind` (enum) |
| **ConflictResolution** | Strategy for resolving sync conflicts: `KeepLocal`, `KeepRemote`, `KeepBoth` (creates copy with suffix). | `ConflictResolution` (enum) |
| **AuthToken** | OAuth2 token with access_token, optional refresh_token, and expiration date. | `AuthToken` |
| **Local-First** | Principle: data is always local first. App works 100% offline. Sync is opt-in and never mandatory. | Architectural concept |
| **Cloud-Aware** | UI shows cloud options from the start, but never forces them. Disconnecting never deletes data. | UX concept |

---

## Settings & Themes

| Term | Definition | Rust type |
|---|---|---|
| **GlobalSettings** | App-wide settings (theme, language, window bounds). Persisted in `~/.opennote/app_state.json`. | `GlobalSettings` |
| **WorkspaceSettings** | Per-workspace settings (auto-save interval, sidebar width, last opened page). Persisted in `workspace.json`. | `WorkspaceSettings` |
| **EditorPreferences** | Per-page settings (editor mode, split view). Persisted inside the page's `.opn.json`. | `EditorPreferences` |
| **EditorMode** | Page editing mode: `RichText` (TipTap) or `Markdown` (CodeMirror). Toggle via `Cmd+Shift+M`. | `EditorMode` (enum) |
| **ThemeConfig** | Theme configuration with 3 layers: `base_theme`, `accent_color`, `chrome_tint`. | `ThemeConfig` |
| **BaseTheme** | Base visual theme: `Light`, `Dark`, `Paper` (sepia), or `System` (follows OS). Applied via `data-theme` on the HTML element. | `BaseTheme` (enum) |
| **ChromeTint** | Tint of the chrome (sidebar/toolbar): `Neutral` (gray) or `Tinted` (accent color via `color-mix()`). Applied via `data-chrome` on the HTML element. | `ChromeTint` (enum) |
| **Accent Color** | UI highlight color. 10 palettes available: Blue, Indigo, Purple, Berry, Red, Orange, Amber, Green, Teal, Graphite. Each generates 4 CSS variants (base, hover, subtle, onAccent). | `accent_color: String` |

---

## IPC & Architecture

| Term | Definition | Location |
|---|---|---|
| **IPC Command** | Rust function decorated with `#[tauri::command]`, invokable by the frontend via `invoke()`. | `src-tauri/src/commands/` |
| **AppManagedState** | Shared backend state managed by Tauri. Holds up to 10 `WorkspaceContext` instances plus the `SaveCoordinator`. | `src-tauri/src/state.rs` |
| **SaveCoordinator** | Concurrent save manager. Maintains one `Mutex` per `PageId` to serialize read-modify-write operations on the same page. | `src-tauri/src/state.rs` |
| **TypeScript Bindings** | TypeScript types auto-generated by `ts-rs` from Rust structs/enums with `#[derive(TS)]`. Exported to `src/types/bindings/`. CI validates they are up to date. | `ts-rs` crate |
| **Clean Architecture** | Dependencies point inward: `src-tauri → storage → core`. Domain never imports frameworks. | Principle |
| **Bounded Context** | DDD separation into 4 contexts: Core (pure domain), Storage (persistence), Search (indexing), Sync (cloud). Each is an independent Cargo crate. | `crates/` |

---

## Frontend

| Term | Definition | Location |
|---|---|---|
| **Zustand Store** | Reactive state store. Separated by domain: `useWorkspaceStore`, `useMultiWorkspaceStore`, `useNavigationStore`, `usePageStore`, `useUIStore`. | `src/stores/` |
| **TipTap** | Rich text editor framework based on ProseMirror (v3). Extensible via nodes and marks. Used in RichText mode. | `src/components/editor/` |
| **CodeMirror** | Code editor (v6). Used in Markdown mode with syntax highlighting. | `src/components/editor/MarkdownEditor.tsx` |
| **Serialization** | Conversion layer between domain `Block[]` and TipTap `JSONContent`. `blocksToTiptap()` and `tiptapToBlocks()`. | `src/lib/serialization.ts` |
| **SlashCommandMenu** | Command menu activated by typing `/` in the editor. 13 commands organized by category (text, structure, media). | `src/components/editor/SlashCommandMenu.tsx` |
| **FloatingToolbar** | TipTap BubbleMenu that appears when text is selected. Offers inline formatting (bold, italic, link, etc.). | `src/components/editor/FloatingToolbar.tsx` |
| **Auto-Save** | `useAutoSave` hook that debounces saves with a configurable interval (default 1s). Flushes on unmount. | `src/hooks/useAutoSave.ts` |
| **i18n** | Internationalization via `react-i18next`. 2 languages: pt-BR (default) and en. Language switch without restart. | `src/lib/i18n.ts` |

---

## Business Rules & Limits

| Rule | Value | Where enforced |
|---|---|---|
| **Hard Block Limit** | 500 blocks per page | `Page::add_block()` returns an error |
| **Soft Block Limit** | 200 blocks per page | `Page::is_over_soft_limit()` — warning in StatusBar |
| **Trash Retention** | 30 days | `TrashItem::new()` calculates `expires_at` |
| **Max Recent Workspaces** | 10 | `AppState::add_recent_workspace()` truncates |
| **Auto-Save Debounce** | 1000ms (configurable) | `WorkspaceSettings.auto_save_interval_ms` |
| **Title Validation** | Cannot be empty or only whitespace | `Page::new()`, `Notebook::new()`, `Section::new()`, `Workspace::new()` |
| **Tag Normalization** | Lowercase + trim, duplicates ignored | `Page::add_tag()` |
| **Color Validation** | Valid hex (#rgb or #rrggbb) | `Color::new()` |

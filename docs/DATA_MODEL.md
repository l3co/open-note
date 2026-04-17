# Data Model — Open Note

Consolidated reference for all entities, types, JSON schemas, and storage structure. Derived directly from the code in `crates/core/`.

---

## 1. Content Hierarchy

```
Workspace (1)
 └── Notebook (N)
      └── Section (N)
           └── Page (N)
                ├── Block[] (N)
                └── PageAnnotations
                     ├── AnchoredStroke[] (N)
                     └── HighlightAnnotation[] (N)
```

Each level maps to a **directory** on the filesystem, except Block and Annotations which are stored inline in the page's `.opn.json`.

---

## 2. Entities

### Workspace

Defined in `crates/core/src/workspace.rs`.

| Field | Type | Description |
|---|---|---|
| `id` | `WorkspaceId` (UUID) | Unique identifier |
| `name` | `String` | Workspace name (non-empty, trimmed) |
| `root_path` | `PathBuf` | Absolute path on the filesystem |
| `created_at` | `DateTime<Utc>` | Creation date |
| `updated_at` | `DateTime<Utc>` | Last update |
| `settings` | `WorkspaceSettings` | Per-workspace configuration |

**Rules:**
- Name cannot be empty or contain only whitespace
- Name is automatically trimmed

**WorkspaceSettings:**

| Field | Type | Default | Description |
|---|---|---|---|
| `default_notebook_id` | `Option<NotebookId>` | `None` | Default notebook |
| `auto_save_interval_ms` | `u64` | `1000` | Auto-save debounce interval (ms) |
| `sidebar_width` | `u32` | `260` | Sidebar width (px) |
| `sidebar_open` | `bool` | `true` | Sidebar visible |
| `last_opened_page_id` | `Option<PageId>` | `None` | Last opened page (restored on launch) |

**Persistence:** `workspace.json` in the workspace root.

---

### Notebook

Defined in `crates/core/src/notebook.rs`.

| Field | Type | Description |
|---|---|---|
| `id` | `NotebookId` (UUID) | Unique identifier |
| `name` | `String` | Name (non-empty, trimmed) |
| `color` | `Option<Color>` | Hex color (#rrggbb) |
| `icon` | `Option<String>` | Icon (emoji or name) |
| `order` | `u32` | Position in the list |
| `created_at` | `DateTime<Utc>` | Creation date |
| `updated_at` | `DateTime<Utc>` | Last update |

**Persistence:** `notebook.json` inside the notebook's directory.

---

### Section

Defined in `crates/core/src/section.rs`.

| Field | Type | Description |
|---|---|---|
| `id` | `SectionId` (UUID) | Unique identifier |
| `notebook_id` | `NotebookId` (UUID) | Parent notebook |
| `name` | `String` | Name (non-empty, trimmed) |
| `color` | `Option<Color>` | Hex color |
| `order` | `u32` | Position in the list |
| `created_at` | `DateTime<Utc>` | Creation date |
| `updated_at` | `DateTime<Utc>` | Last update |

**Persistence:** `section.json` inside the section's directory.

---

### Page

Defined in `crates/core/src/page.rs`.

| Field | Type | Description |
|---|---|---|
| `id` | `PageId` (UUID) | Unique identifier |
| `section_id` | `SectionId` (UUID) | Parent section |
| `title` | `String` | Title or `"[Protected page]"` |
| `tags` | `Vec<String>` | Free-form tags (empty if protected) |
| `blocks` | `Vec<Block>` | Content blocks (empty if protected) |
| `annotations` | `PageAnnotations` | Strokes and highlights (empty if protected) |
| `editor_preferences` | `EditorPreferences` | Per-page editor mode |
| `pdf_asset` | `Option<String>` | Absolute path to PDF asset |
| `pdf_total_pages` | `Option<u32>` | Number of PDF pages |
| `created_at` | `DateTime<Utc>` | Creation date |
| `updated_at` | `DateTime<Utc>` | Last update |
| `schema_version` | `u32` | Schema version (current: 2) |
| `protection` | `Option<PageProtection>` | Encryption metadata |
| `encrypted_content` | `Option<String>` | Encrypted payload as Base64 |

**`PageProtection`:**

| Field | Type | Description |
|---|---|---|
| `algorithm` | `EncryptionAlgorithm` | `aes_gcm_256` |
| `kdf` | `KeyDerivationFunction` | `argon2id` |
| `kdf_params` | `KdfParams` | Argon2 parameters (m_cost, t_cost, etc.) |
| `salt` | `String` | Random salt (Base64) |
| `nonce` | `String` | Random IV (Base64) |

**`PageSummary`:**

| Field | Type | Description |
|---|---|---|
| `id` | `PageId` | Unique identifier |
| `title` | `String` | Title or placeholder |
| `is_protected` | `bool` | Whether the page requires a password |
| ... | ... | (other metadata fields) |

**Constants:**
- `SOFT_BLOCK_LIMIT = 200`
- `HARD_BLOCK_LIMIT = 500`
- `PROTECTED_TITLE_PLACEHOLDER = "[Protected page]"`

**Persistence:** `{slug}.opn.json` inside the section's directory.

---

### Block (Tagged Union)

Defined in `crates/core/src/block.rs`.

All blocks share a common base (`BlockBase`):

| Field | Type | Description |
|---|---|---|
| `id` | `BlockId` (UUID) | Unique identifier |
| `order` | `u32` | Position in the page |
| `created_at` | `DateTime<Utc>` | Creation date |
| `updated_at` | `DateTime<Utc>` | Last update |

Serialization uses `#[serde(tag = "type", rename_all = "snake_case")]`:

#### TextBlock (`"text"`)
| Field | Type | Description |
|---|---|---|
| `content` | `serde_json::Value` | TipTap JSON (`{ tiptap_json: { type: "doc", content: [...] } }`) |

#### MarkdownBlock (`"markdown"`)
| Field | Type | Description |
|---|---|---|
| `content` | `String` | Raw Markdown text |

#### CodeBlock (`"code"`)
| Field | Type | Description |
|---|---|---|
| `language` | `Option<String>` | Language tag (e.g. `"rust"`, `"javascript"`) |
| `content` | `String` | Source code |

#### ChecklistBlock (`"checklist"`)
| Field | Type | Description |
|---|---|---|
| `items` | `Vec<ChecklistItem>` | `{ text: String, checked: bool }` |

#### TableBlock (`"table"`)
| Field | Type | Description |
|---|---|---|
| `rows` | `Vec<Vec<String>>` | Cells as a matrix of strings |
| `has_header` | `bool` | First row is a header |

#### ImageBlock (`"image"`)
| Field | Type | Description |
|---|---|---|
| `src` | `String` | Relative path to asset (e.g. `"assets/img-abc.png"`) |
| `alt` | `Option<String>` | Alt text |
| `width` | `Option<u32>` | Width in pixels |
| `height` | `Option<u32>` | Height in pixels |

#### InkBlock (`"ink"`)
| Field | Type | Description |
|---|---|---|
| `strokes` | `Vec<serde_json::Value>` | Canvas strokes |
| `width` | `u32` | Canvas width |
| `height` | `u32` | Canvas height |

#### PdfBlock (`"pdf"`)
| Field | Type | Description |
|---|---|---|
| `src` | `String` | Relative path to PDF |
| `total_pages` | `u32` | Total PDF pages |

#### DividerBlock (`"divider"`)
No additional fields. Base only.

#### CalloutBlock (`"callout"`)
| Field | Type | Description |
|---|---|---|
| `variant` | `CalloutVariant` | `info`, `warning`, `error`, `success`, `tip` |
| `content` | `String` | Callout text |

#### EmbedBlock (`"embed"`)
| Field | Type | Description |
|---|---|---|
| `url` | `String` | Embedded content URL |
| `title` | `Option<String>` | OG title |
| `description` | `Option<String>` | OG description |
| `thumbnail` | `Option<String>` | Thumbnail URL |

---

## 3. Annotations

Defined in `crates/core/src/annotation.rs`.

### PageAnnotations

| Field | Type | Description |
|---|---|---|
| `strokes` | `Vec<AnchoredStroke>` | Ink strokes (ink overlay) |
| `highlights` | `Vec<HighlightAnnotation>` | Text markings |
| `svg_cache` | `Option<String>` | Path to SVG cache |

### AnchoredStroke

| Field | Type | Description |
|---|---|---|
| `id` | `StrokeId` (UUID) | Identifier |
| `points` | `Vec<StrokePoint>` | Points `{ x: f64, y: f64, pressure: f32 }` |
| `color` | `String` | Hex color |
| `size` | `f32` | Stroke width |
| `tool` | `InkTool` | `pen`, `marker`, `eraser` |
| `opacity` | `f32` | Opacity (0.0–1.0) |
| `timestamp` | `i64` | Unix timestamp |
| `anchor` | `Option<StrokeAnchor>` | Block anchor |

### StrokeAnchor

| Field | Type | Description |
|---|---|---|
| `block_id` | `BlockId` | Target block |
| `offset_x` | `f64` | X offset relative to block |
| `offset_y` | `f64` | Y offset relative to block |
| `pdf_page` | `Option<u32>` | PDF page number (if inside a PdfBlock) |

### HighlightAnnotation

| Field | Type | Description |
|---|---|---|
| `id` | `AnnotationId` (UUID) | Identifier |
| `block_id` | `BlockId` | Target block |
| `start_offset` | `u32` | Character offset (start) |
| `end_offset` | `u32` | Character offset (end) |
| `color` | `String` | Hex color |
| `opacity` | `f32` | Opacity (default 0.3) |

---

## 4. Global Settings

Defined in `crates/core/src/settings.rs`.

### AppState

Persisted in `~/.opennote/app_state.json`.

| Field | Type | Description |
|---|---|---|
| `recent_workspaces` | `Vec<RecentWorkspace>` | Up to 10 recent workspaces |
| `last_opened_workspace` | `Option<PathBuf>` | Last opened workspace |
| `global_settings` | `GlobalSettings` | Global configuration |

### RecentWorkspace

| Field | Type | Description |
|---|---|---|
| `path` | `PathBuf` | Absolute path |
| `name` | `String` | Workspace name |
| `last_opened_at` | `DateTime<Utc>` | When it was last opened |

### GlobalSettings

| Field | Type | Default | Description |
|---|---|---|---|
| `theme` | `ThemeConfig` | System/Blue/Neutral | Theme configuration |
| `language` | `Language` | `En` | Language (`pt_br`, `en`) |
| `window_bounds` | `Option<WindowBounds>` | `None` | Window position/size |

### ThemeConfig

| Field | Type | Default | Description |
|---|---|---|---|
| `base_theme` | `BaseTheme` | `System` | `light`, `dark`, `paper`, `system` |
| `accent_color` | `String` | `"Blue"` | Palette name (10 options) |
| `chrome_tint` | `ChromeTint` | `Neutral` | `neutral`, `tinted` |

### WindowBounds

| Field | Type | Description |
|---|---|---|
| `x` | `i32` | X position |
| `y` | `i32` | Y position |
| `width` | `u32` | Width |
| `height` | `u32` | Height |
| `maximized` | `bool` | Window maximized |

---

## 5. Trash

Defined in `crates/core/src/trash.rs`.

### TrashManifest

Persisted in `.trash/trash_manifest.json`.

| Field | Type | Description |
|---|---|---|
| `items` | `Vec<TrashItem>` | Items in the trash |

### TrashItem

| Field | Type | Description |
|---|---|---|
| `id` | `String` (UUID) | Trash item identifier |
| `item_type` | `TrashItemType` | `page`, `section`, `notebook` |
| `original_title` | `String` | Original title |
| `original_path` | `String` | Original relative path |
| `original_notebook` | `String` | Notebook name |
| `original_section` | `Option<String>` | Section name (if applicable) |
| `deleted_at` | `DateTime<Utc>` | When it was deleted |
| `expires_at` | `DateTime<Utc>` | Expiry date (deleted_at + 30 days) |
| `size_bytes` | `u64` | Size in bytes |

**Constant:** `DEFAULT_TRASH_RETENTION_DAYS = 30`

---

## 6. Newtype IDs

Defined in `crates/core/src/id.rs`. All generated via the `define_id!` macro:

| Type | Wrapper | Usage |
|---|---|---|
| `WorkspaceId` | `Uuid` | Identifies a workspace |
| `NotebookId` | `Uuid` | Identifies a notebook |
| `SectionId` | `Uuid` | Identifies a section |
| `PageId` | `Uuid` | Identifies a page |
| `BlockId` | `Uuid` | Identifies a block |
| `StrokeId` | `Uuid` | Identifies an ink stroke |
| `AnnotationId` | `Uuid` | Identifies a highlight |

Implement: `Debug`, `Clone`, `Copy`, `PartialEq`, `Eq`, `Hash`, `Serialize`, `Deserialize`, `Display`, `From<Uuid>`, `TS`.

JSON serialization: UUID string (e.g. `"550e8400-e29b-41d4-a716-446655440000"`).

---

## 7. Color (Value Object)

Defined in `crates/core/src/color.rs`.

| Field | Type | Validation |
|---|---|---|
| `hex` | `String` | Format `#rrggbb` or `#rgb`. `#` is auto-prepended if missing. |

---

## 8. Errors

### CoreError (`crates/core/src/error.rs`)

| Variant | Fields | Description |
|---|---|---|
| `Validation` | `message: String` | Business rule violation (empty name, limit exceeded) |
| `NotFound` | `entity: String, id: String` | Entity not found |

### StorageError (`crates/storage/src/error.rs`)

| Variant | Description |
|---|---|
| `WorkspaceNotFound` | Workspace does not exist at the given path |
| `NotebookAlreadyExists` | Duplicate name |
| `NotebookNotFound` | Notebook not found |
| `SectionAlreadyExists` | Duplicate name |
| `SectionNotFound` | Section not found |
| `PageNotFound` | Page not found by ID |
| `SchemaVersionMismatch` | Incompatible schema version |
| `WorkspaceLocked` | Workspace in use by another process (PID) |
| `TrashItemNotFound` | Trash item not found |
| `Io` | I/O error (from `std::io::Error`) |
| `Serialization` | JSON error (from `serde_json::Error`) |
| `Core` | Domain error propagated (from `CoreError`) |

---

## 9. Example `.opn.json`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "section_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "title": "Lecture 01 — Introduction",
  "tags": ["study", "important"],
  "blocks": [
    {
      "type": "text",
      "id": "a1b2c3d4-0000-0000-0000-000000000001",
      "order": 0,
      "created_at": "2026-03-07T12:00:00Z",
      "updated_at": "2026-03-07T14:30:00Z",
      "content": {
        "tiptap_json": {
          "type": "doc",
          "content": [
            {
              "type": "heading",
              "attrs": { "level": 1 },
              "content": [{ "type": "text", "text": "Introduction" }]
            },
            {
              "type": "paragraph",
              "content": [{ "type": "text", "text": "First lecture of the course." }]
            }
          ]
        }
      }
    },
    {
      "type": "code",
      "id": "a1b2c3d4-0000-0000-0000-000000000002",
      "order": 1,
      "created_at": "2026-03-07T12:05:00Z",
      "updated_at": "2026-03-07T12:05:00Z",
      "language": "rust",
      "content": "fn main() {\n    println!(\"Hello!\");\n}"
    },
    {
      "type": "divider",
      "id": "a1b2c3d4-0000-0000-0000-000000000003",
      "order": 2,
      "created_at": "2026-03-07T12:10:00Z",
      "updated_at": "2026-03-07T12:10:00Z"
    },
    {
      "type": "callout",
      "id": "a1b2c3d4-0000-0000-0000-000000000004",
      "order": 3,
      "created_at": "2026-03-07T12:15:00Z",
      "updated_at": "2026-03-07T12:15:00Z",
      "variant": "tip",
      "content": "Remember to review before the exam!"
    }
  ],
  "annotations": {
    "strokes": [],
    "highlights": [],
    "svg_cache": null
  },
  "editor_preferences": {
    "mode": "rich_text",
    "split_view": false
  },
  "created_at": "2026-03-07T12:00:00Z",
  "updated_at": "2026-03-07T14:30:00Z",
  "schema_version": 2
}
```

---

## 10. TypeScript Bindings

All Rust types with `#[derive(TS)]` automatically generate TypeScript types in `src/types/bindings/`:

```
src/types/bindings/
├── AppState.ts
├── Block.ts
├── BlockBase.ts
├── CalloutVariant.ts
├── ChecklistBlock.ts
├── CodeBlock.ts
├── Color.ts
├── ... (48 files total)
├── Workspace.ts
└── WorkspaceSettings.ts
```

CI validates that bindings are up-to-date: `git diff --exit-code src/types/bindings/`.

---

## Related Documents

| Document | Content |
|---|---|
| [GLOSSARY.md](./GLOSSARY.md) | Domain term definitions |
| [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) | System design |
| [IPC_REFERENCE.md](./IPC_REFERENCE.md) | IPC command reference |

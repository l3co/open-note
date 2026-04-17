# Architecture — Diagrams

Visual diagrams of Open Note in Mermaid format (renders natively on GitHub). Complements [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md).

---

## 1. C4 — System Context

Outermost view: Open Note and its actors/neighboring systems.

```mermaid
C4Context
    title Open Note — Context Diagram

    Person(user, "User", "Person who creates and organizes notes")

    System(opennote, "Open Note", "Local-first desktop app for notes with rich text, markdown, ink, and PDF")

    System_Ext(gdrive, "Google Drive", "Cloud storage")
    System_Ext(onedrive, "OneDrive", "Cloud storage")
    System_Ext(dropbox, "Dropbox", "Cloud storage")
    System_Ext(fs, "Local Filesystem", "~/OpenNote/ — user data")

    Rel(user, opennote, "Creates, edits, and organizes notes")
    Rel(opennote, fs, "Reads/writes data", "JSON, assets")
    Rel(opennote, gdrive, "Bidirectional sync", "OAuth2, opt-in")
    Rel(opennote, onedrive, "Bidirectional sync", "OAuth2, opt-in")
    Rel(opennote, dropbox, "Bidirectional sync", "OAuth2, opt-in")
```

---

## 2. C4 — Containers

Internal layers of the application.

```mermaid
C4Container
    title Open Note — Container Diagram

    Person(user, "User")

    Container_Boundary(app, "Open Note Desktop") {
        Container(frontend, "Frontend", "React 19, TypeScript, TailwindCSS", "UI: editor, sidebar, settings, search, ink, PDF")
        Container(ipc, "Tauri IPC Bridge", "Tauri v2", "~80 typed commands — serde ↔ JSON serialization")
        Container(backend, "Rust Backend", "Cargo Workspace", "Domain, storage, search, sync")
    }

    System_Ext(fs, "Local Filesystem", "~/OpenNote/")
    System_Ext(cloud, "Cloud Providers", "GDrive, OneDrive, Dropbox")

    Rel(user, frontend, "Interacts via UI")
    Rel(frontend, ipc, "invoke(command, args)", "JSON")
    Rel(ipc, backend, "Direct Rust call")
    Rel(backend, fs, "Reads/writes", "atomic writes")
    Rel(backend, cloud, "Upload/download", "OAuth2 HTTP")
```

---

## 3. C4 — Backend Components (Rust)

Cargo workspace crates and their dependencies.

```mermaid
graph TB
    subgraph "src-tauri (IPC Layer)"
        commands["commands/<br/>~80 IPC handlers"]
        state["state.rs<br/>AppManagedState<br/>SaveCoordinator"]
    end

    subgraph "crates/storage"
        engine["FsStorageEngine<br/>filesystem CRUD"]
        atomic["atomic.rs<br/>write-tmp-rename-fsync"]
        lock["lock.rs<br/>workspace .lock + PID"]
        slug["slug.rs<br/>Unicode normalization"]
        migrations["migrations.rs<br/>schema v1→v2→..."]
    end

    subgraph "crates/search"
        search_engine["SearchEngine<br/>Tantivy 0.22"]
        schema["schema.rs<br/>custom tokenizer"]
        extract["extract.rs<br/>text extraction"]
    end

    subgraph "crates/sync"
        coordinator["SyncCoordinator<br/>orchestrator"]
        manifest["SyncManifest<br/>SHA-256 hashes"]
        providers["providers/<br/>GDrive, OneDrive, Dropbox"]
    end

    subgraph "crates/core (Pure Domain)"
        entities["Workspace, Notebook<br/>Section, Page, Block"]
        annotations["PageAnnotations<br/>Strokes, Highlights"]
        settings["AppState<br/>GlobalSettings<br/>ThemeConfig"]
        trash["TrashManifest<br/>TrashItem"]
        ids["Newtype IDs<br/>PageId, BlockId..."]
        errors["CoreError"]
    end

    commands --> engine
    commands --> search_engine
    commands --> coordinator
    commands --> state

    engine --> entities
    engine --> trash
    engine --> atomic
    engine --> lock
    engine --> slug
    engine --> migrations

    search_engine --> entities
    search_engine --> extract
    search_engine --> schema

    coordinator --> manifest
    coordinator --> providers

    state --> ids
    state --> search_engine
    state --> coordinator

    style entities fill:#4ade80,color:#000
    style annotations fill:#4ade80,color:#000
    style settings fill:#4ade80,color:#000
    style trash fill:#4ade80,color:#000
    style ids fill:#4ade80,color:#000
    style errors fill:#4ade80,color:#000
```

---

## 4. C4 — Frontend Components (React)

```mermaid
graph TB
    subgraph "App.tsx (Root)"
        app["App"]
    end

    subgraph "Layout"
        toolbar["Toolbar<br/>drag region, nav, breadcrumb"]
        sidebar["Sidebar<br/>resizable, NotebookTree"]
        content["ContentArea<br/>loading/welcome/page"]
        statusbar["StatusBar<br/>path, blocks, save, sync"]
    end

    subgraph "Editor"
        page_editor["PageEditor<br/>orchestrator"]
        title_editor["TitleEditor"]
        block_editor["BlockEditor<br/>TipTap instance"]
        md_editor["MarkdownEditor<br/>CodeMirror"]
        floating["FloatingToolbar<br/>BubbleMenu"]
        slash["SlashCommandMenu<br/>13 commands"]
    end

    subgraph "Overlays & Modals"
        workspace_picker["WorkspacePicker"]
        settings["SettingsDialog<br/>6 tabs"]
        quick_open["QuickOpen<br/>Cmd+P"]
        search_panel["SearchPanel<br/>Cmd+Shift+F"]
        trash_panel["TrashPanel"]
        sync_settings["SyncSettings"]
        onboarding["OnboardingDialog"]
    end

    subgraph "Stores (Zustand)"
        ws_store["useWorkspaceStore"]
        nav_store["useNavigationStore"]
        page_store["usePageStore"]
        ui_store["useUIStore"]
        ann_store["useAnnotationStore"]
    end

    subgraph "Lib"
        ipc["ipc.ts<br/>~80 typed wrappers"]
        serial["serialization.ts<br/>Block ↔ TipTap"]
        markdown["markdown.ts<br/>TipTap ↔ MD"]
        theme["theme.ts<br/>CSS vars, palettes"]
        i18n["i18n.ts<br/>pt-BR, en"]
    end

    app --> toolbar
    app --> sidebar
    app --> content
    app --> statusbar
    app --> workspace_picker
    app --> settings
    app --> quick_open
    app --> search_panel
    app --> trash_panel
    app --> sync_settings
    app --> onboarding

    content --> page_editor
    page_editor --> title_editor
    page_editor --> block_editor
    page_editor --> md_editor
    block_editor --> floating
    block_editor --> slash

    sidebar --> ws_store
    sidebar --> nav_store
    page_editor --> page_store
    page_editor --> serial
    md_editor --> markdown

    ws_store --> ipc
    page_store --> ipc
    ui_store --> theme
```

---

## 5. Cargo Dependency Diagram

```mermaid
graph LR
    src_tauri["src-tauri<br/>(Tauri app)"]
    storage["crates/storage<br/>(filesystem)"]
    search["crates/search<br/>(Tantivy)"]
    sync["crates/sync<br/>(cloud)"]
    core["crates/core<br/>(pure domain)"]

    src_tauri --> storage
    src_tauri --> search
    src_tauri --> sync
    storage --> core
    search --> core
    sync --> core

    style core fill:#4ade80,color:#000
    style storage fill:#60a5fa,color:#000
    style search fill:#60a5fa,color:#000
    style sync fill:#60a5fa,color:#000
    style src_tauri fill:#f59e0b,color:#000
```

**Inviolable rule:** Arrows point inward. `core` never imports anything from other crates.

---

## 6. ER Diagram — Domain Model

```mermaid
erDiagram
    Workspace ||--o{ Notebook : contains
    Notebook ||--o{ Section : contains
    Section ||--o{ Page : contains
    Page ||--o{ Block : contains
    Page ||--|| PageAnnotations : has
    PageAnnotations ||--o{ AnchoredStroke : contains
    PageAnnotations ||--o{ HighlightAnnotation : contains
    AnchoredStroke ||--o| StrokeAnchor : anchored_to

    Workspace {
        WorkspaceId id PK
        string name
        PathBuf root_path
        WorkspaceSettings settings
        DateTime created_at
        DateTime updated_at
    }

    Notebook {
        NotebookId id PK
        string name
        Color color
        string icon
        u32 order
        DateTime created_at
        DateTime updated_at
    }

    Section {
        SectionId id PK
        NotebookId notebook_id FK
        string name
        Color color
        u32 order
        DateTime created_at
        DateTime updated_at
    }

    Page {
        PageId id PK
        SectionId section_id FK
        string title
        Vec_String tags
        EditorPreferences editor_preferences
        u32 schema_version
        DateTime created_at
        DateTime updated_at
    }

    Block {
        BlockId id PK
        string type
        u32 order
        JSON content
        DateTime created_at
        DateTime updated_at
    }

    PageAnnotations {
        Vec_AnchoredStroke strokes
        Vec_HighlightAnnotation highlights
        string svg_cache
    }

    AnchoredStroke {
        StrokeId id PK
        Vec_StrokePoint points
        string color
        f32 size
        InkTool tool
        f32 opacity
    }

    StrokeAnchor {
        BlockId block_id FK
        f64 offset_x
        f64 offset_y
        u32 pdf_page
    }

    HighlightAnnotation {
        AnnotationId id PK
        BlockId block_id FK
        u32 start_offset
        u32 end_offset
        string color
        f32 opacity
    }
```

---

## 7. State Diagram — App Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Initializing: App opens

    Initializing --> RestoringSession: Loads AppState
    RestoringSession --> WorkspacePicker: No previous workspace OR error opening
    RestoringSession --> MainApp: Workspace restored successfully

    WorkspacePicker --> CreatingWorkspace: "Create new"
    WorkspacePicker --> OpeningWorkspace: "Open existing"
    WorkspacePicker --> OpeningWorkspace: Clicks recent

    CreatingWorkspace --> MainApp: Success
    CreatingWorkspace --> WorkspacePicker: Error

    OpeningWorkspace --> MainApp: Success
    OpeningWorkspace --> WorkspacePicker: Error (lock, not found)

    MainApp --> WorkspacePicker: Cmd+Shift+O

    state MainApp {
        [*] --> WelcomePage: No page selected
        WelcomePage --> PageView: Selects page in sidebar
        PageView --> WelcomePage: Deletes last page
        PageView --> PageView: Navigates to another page

        state PageView {
            [*] --> RichTextMode
            RichTextMode --> MarkdownMode: Cmd+Shift+M
            MarkdownMode --> RichTextMode: Cmd+Shift+M
        }
    }
```

---

## 8. Sequence Diagram — App Initialization

```mermaid
sequenceDiagram
    participant User
    participant App as App.tsx
    participant UIStore as useUIStore
    participant IPC as ipc.ts
    participant Rust as src-tauri
    participant Storage as FsStorageEngine
    participant FS as Filesystem

    User->>App: Opens application
    App->>App: useState(initializing=true)

    App->>IPC: getAppState()
    IPC->>Rust: invoke("get_app_state")
    Rust->>Storage: load_app_state()
    Storage->>FS: read ~/.opennote/app_state.json
    FS-->>Storage: JSON
    Storage-->>Rust: AppState
    Rust-->>IPC: AppState
    IPC-->>App: AppState

    App->>UIStore: setTheme(appState.theme)
    App->>UIStore: applyThemeToDOM()

    alt Has last_opened_workspace
        App->>IPC: openWorkspace(path)
        IPC->>Rust: invoke("open_workspace", {path})
        Rust->>Storage: open_workspace(path)
        Storage->>FS: acquire .lock
        Storage->>FS: read workspace.json
        FS-->>Storage: Workspace
        Storage-->>Rust: Workspace
        Rust->>Rust: init SearchEngine
        Rust->>Rust: init SyncCoordinator
        Rust-->>IPC: Workspace
        IPC-->>App: Workspace
        App->>App: Render MainApp
    else No workspace or error
        App->>UIStore: openWorkspacePicker()
        App->>App: Render WorkspacePicker
    end

    App->>App: Check onboarding flag
    App->>App: setInitializing(false)
```

---

## 9. Sequence Diagram — Save Page (Auto-Save)

```mermaid
sequenceDiagram
    participant User
    participant TipTap as BlockEditor (TipTap)
    participant Serial as serialization.ts
    participant Hook as useAutoSave
    participant Store as usePageStore
    participant IPC as ipc.ts
    participant Rust as src-tauri
    participant SC as SaveCoordinator
    participant Storage as FsStorageEngine
    participant FS as Filesystem

    User->>TipTap: Types text
    TipTap->>TipTap: onUpdate callback
    TipTap->>Serial: tiptapToBlocks(doc, existingBlocks)
    Serial-->>TipTap: Block[]

    TipTap->>Hook: onChange(blocks)
    Hook->>Hook: Reset debounce timer (1s)

    Note over Hook: 1 second without edits...

    Hook->>Store: updateBlocks(pageId, blocks)
    Store->>Store: setSaveStatus("saving")
    Store->>IPC: updatePageBlocks(pageId, blocks)
    IPC->>Rust: invoke("update_page_blocks", {page_id, blocks})

    Rust->>SC: with_page_lock(pageId)
    SC->>SC: Acquires Mutex for pageId
    SC->>Storage: load_page(root, pageId)
    Storage->>FS: read {slug}.opn.json
    FS-->>Storage: Page JSON
    Storage-->>SC: Page

    SC->>SC: page.blocks = blocks
    SC->>SC: page.updated_at = now()

    SC->>Storage: update_page(root, page)
    Storage->>FS: write {slug}.opn.json.tmp
    Storage->>FS: fsync()
    Storage->>FS: rename → {slug}.opn.json
    Storage->>FS: fsync(dir)

    SC->>SC: Releases Mutex
    SC-->>Rust: Page (updated)
    Rust-->>IPC: Page
    IPC-->>Store: Page
    Store->>Store: setSaveStatus("saved")
```

---

## 10. Sequence Diagram — Full-Text Search

```mermaid
sequenceDiagram
    participant User
    participant Panel as SearchPanel
    participant IPC as ipc.ts
    participant Rust as src-tauri
    participant SE as SearchEngine
    participant Tantivy as Tantivy Index

    User->>Panel: Cmd+Shift+F (opens panel)
    User->>Panel: Types "café"
    Panel->>Panel: Debounce 150ms

    Panel->>IPC: searchPages({query: "café"})
    IPC->>Rust: invoke("search_pages", {query})
    Rust->>SE: search(SearchQuery)

    SE->>SE: parse_query_lenient("café")
    SE->>Tantivy: searcher.search(query, limit)
    Tantivy->>Tantivy: AsciiFoldingFilter: "café" → "cafe"
    Tantivy->>Tantivy: Match in title (boost 2.0), content, tags (boost 1.5)
    Tantivy-->>SE: TopDocs

    SE->>SE: Generate snippets with context
    SE-->>Rust: SearchResults
    Rust-->>IPC: SearchResults
    IPC-->>Panel: SearchResults

    Panel->>Panel: Renders results with snippets
    User->>Panel: Clicks a result
    Panel->>Panel: Navigates to page
```

---

## 11. Sequence Diagram — Create Notebook

```mermaid
sequenceDiagram
    participant User
    participant Dialog as CreateDialog
    participant Store as useWorkspaceStore
    participant IPC as ipc.ts
    participant Rust as src-tauri
    participant Storage as FsStorageEngine
    participant FS as Filesystem

    User->>Dialog: Clicks "New Notebook"
    Dialog->>Dialog: Opens modal with input

    User->>Dialog: Types "Study Notes" + confirms
    Dialog->>Store: createNotebook("Study Notes")

    Store->>IPC: createNotebook("Study Notes")
    IPC->>Rust: invoke("create_notebook", {name: "Study Notes"})

    Rust->>Storage: create_notebook(root, "Study Notes")
    Storage->>Storage: Notebook::new("Study Notes", order)
    Storage->>Storage: unique_slug("Study Notes") → "study-notes"
    Storage->>FS: mkdir ~/OpenNote/study-notes/
    Storage->>FS: write notebook.json (atomic)
    Storage-->>Rust: Notebook
    Rust-->>IPC: Notebook
    IPC-->>Store: Notebook

    Store->>Store: Adds notebook to list
    Dialog->>Dialog: Closes modal
```

---

## 12. Sequence Diagram — Sync (Change Detection)

```mermaid
sequenceDiagram
    participant SC as SyncCoordinator
    participant Manifest as SyncManifest
    participant FS as Local Filesystem
    participant Provider as CloudProvider
    participant User as UI (Conflict Dialog)

    SC->>FS: collect_local_files()
    FS-->>SC: Vec<(path, hash)>

    SC->>Provider: list_files("/")
    Provider-->>SC: Vec<RemoteFile>

    SC->>Manifest: load()
    Manifest-->>SC: HashMap<path, hash>

    loop For each file
        SC->>SC: detect_change(local_hash, manifest_hash, remote_hash)
        alt LocalOnly
            SC->>Provider: upload_file(local, remote)
        else RemoteOnly
            SC->>Provider: download_file(remote, local)
        else LocalModified
            SC->>Provider: upload_file(local, remote)
        else RemoteModified
            SC->>Provider: download_file(remote, local)
        else BothModified
            SC->>User: Show conflict
            User-->>SC: ConflictResolution (KeepLocal/Remote/Both)
            SC->>SC: resolve_conflict(resolution)
        else Unchanged
            SC->>SC: Skip
        end
    end

    SC->>Manifest: save(updated_hashes)
```

---

## 13. Sequence Diagram — Soft Delete and Restore

```mermaid
sequenceDiagram
    participant User
    participant Sidebar as NotebookTree
    participant Store as useWorkspaceStore
    participant IPC as ipc.ts
    participant Rust as src-tauri
    participant Storage as FsStorageEngine
    participant FS as Filesystem

    User->>Sidebar: Right-click page → "Delete"

    Sidebar->>Store: deletePage(pageId)
    Store->>IPC: deletePage(pageId)
    IPC->>Rust: invoke("delete_page", {page_id})

    Rust->>Storage: delete_page(root, pageId)
    Storage->>FS: Reads page JSON
    Storage->>Storage: Creates TrashItem with metadata
    Storage->>FS: Moves page + assets → .trash/{uuid}/
    Storage->>FS: Updates trash_manifest.json (atomic)
    Storage-->>Rust: Ok
    Rust-->>IPC: Ok
    IPC-->>Store: Ok
    Store->>Store: Removes page from list

    Note over User: Later...

    User->>User: Opens TrashPanel
    User->>IPC: restoreFromTrash(trashItemId)
    IPC->>Rust: invoke("restore_from_trash", {id})
    Rust->>Storage: restore_from_trash(root, id)
    Storage->>FS: Reads trash_manifest.json
    Storage->>FS: Moves from .trash/{uuid}/ → original path
    Storage->>FS: Updates trash_manifest.json (atomic)
    Storage-->>Rust: Ok
    Rust-->>IPC: Ok
    IPC-->>User: Page restored
```

---

## 14. Sequence Diagram — Theme Switch

```mermaid
sequenceDiagram
    participant User
    participant Settings as AppearanceSection
    participant Store as useUIStore
    participant DOM as document.documentElement
    participant IPC as ipc.ts
    participant Rust as src-tauri

    User->>Settings: Clicks "Dark"
    Settings->>Store: setTheme({baseTheme: "dark", ...})

    Store->>Store: Updates state.theme
    Store->>DOM: dataset.theme = "dark"
    Store->>DOM: dataset.chrome = "neutral"
    Store->>DOM: style.setProperty("--accent-*", palette)

    Note over DOM: CSS vars apply theme immediately

    Settings->>IPC: updateGlobalSettings({theme: newConfig})
    IPC->>Rust: invoke("update_global_settings", {settings})
    Rust->>Rust: Persists to app_state.json
    Rust-->>IPC: Ok
```

---

## 15. Filesystem Directory Structure

```mermaid
graph TB
    subgraph "Global State (~/.opennote/)"
        app_state["app_state.json<br/>recent workspaces, theme, language"]
    end

    subgraph "Workspace (~/OpenNote/)"
        ws_json["workspace.json"]
        lock[".lock (PID)"]

        subgraph ".trash/"
            manifest["trash_manifest.json"]
            trash_item["{uuid}/ — deleted items"]
        end

        subgraph ".opennote/"
            index["index/ — Tantivy"]
            sync_manifest["sync_manifest.json"]
        end

        subgraph "notebook-a/"
            nb_json["notebook.json"]

            subgraph "section-1/"
                sec_json["section.json"]
                page1["lecture-01.opn.json"]
                page2["lecture-02.opn.json"]

                subgraph "assets/"
                    img["img-abc123.png"]
                    pdf["doc-def456.pdf"]
                end
            end
        end
    end
```

---

## Related Documents

| Document | Content |
|---|---|
| [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) | System design — vision, principles, models |
| [DATA_MODEL.md](./DATA_MODEL.md) | Detailed data model with JSON schemas |
| [IPC_REFERENCE.md](./IPC_REFERENCE.md) | Complete IPC command reference |
| [GLOSSARY.md](./GLOSSARY.md) | DDD glossary — ubiquitous language |

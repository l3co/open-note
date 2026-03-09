# Arquitetura — Diagramas

Diagramas visuais do Open Note em formato Mermaid (renderiza nativamente no GitHub). Complementa o [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md).

---

## 1. C4 — Contexto do Sistema

Visão mais externa: o Open Note e seus atores/sistemas vizinhos.

```mermaid
C4Context
    title Open Note — Diagrama de Contexto

    Person(user, "Usuário", "Pessoa que cria e organiza anotações")

    System(opennote, "Open Note", "App desktop local-first para anotações com rich text, markdown, ink e PDF")

    System_Ext(gdrive, "Google Drive", "Armazenamento cloud")
    System_Ext(onedrive, "OneDrive", "Armazenamento cloud")
    System_Ext(dropbox, "Dropbox", "Armazenamento cloud")
    System_Ext(fs, "Filesystem Local", "~/OpenNote/ — dados do usuário")

    Rel(user, opennote, "Cria, edita e organiza anotações")
    Rel(opennote, fs, "Lê/escreve dados", "JSON, assets")
    Rel(opennote, gdrive, "Sync bidirecional", "OAuth2, opt-in")
    Rel(opennote, onedrive, "Sync bidirecional", "OAuth2, opt-in")
    Rel(opennote, dropbox, "Sync bidirecional", "OAuth2, opt-in")
```

---

## 2. C4 — Containers

Camadas internas da aplicação.

```mermaid
C4Container
    title Open Note — Diagrama de Containers

    Person(user, "Usuário")

    Container_Boundary(app, "Open Note Desktop") {
        Container(frontend, "Frontend", "React 19, TypeScript, TailwindCSS", "UI: editor, sidebar, settings, search, ink, PDF")
        Container(ipc, "Tauri IPC Bridge", "Tauri v2", "46 commands tipados — serialização serde ↔ JSON")
        Container(backend, "Backend Rust", "Cargo Workspace", "Domínio, storage, search, sync")
    }

    System_Ext(fs, "Filesystem Local", "~/OpenNote/")
    System_Ext(cloud, "Cloud Providers", "GDrive, OneDrive, Dropbox")

    Rel(user, frontend, "Interage via UI")
    Rel(frontend, ipc, "invoke(command, args)", "JSON")
    Rel(ipc, backend, "Chamada direta Rust")
    Rel(backend, fs, "Lê/escreve", "atomic writes")
    Rel(backend, cloud, "Upload/download", "OAuth2 HTTP")
```

---

## 3. C4 — Componentes do Backend (Rust)

Crates do Cargo workspace e suas dependências.

```mermaid
graph TB
    subgraph "src-tauri (IPC Layer)"
        commands["commands/<br/>46 handlers IPC"]
        state["state.rs<br/>AppManagedState<br/>SaveCoordinator"]
    end

    subgraph "crates/storage"
        engine["FsStorageEngine<br/>CRUD filesystem"]
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

    subgraph "crates/core (Domínio Puro)"
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

## 4. C4 — Componentes do Frontend (React)

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
        ipc["ipc.ts<br/>46 typed wrappers"]
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

## 5. Diagrama de Dependências Cargo

```mermaid
graph LR
    src_tauri["src-tauri<br/>(Tauri app)"]
    storage["crates/storage<br/>(filesystem)"]
    search["crates/search<br/>(Tantivy)"]
    sync["crates/sync<br/>(cloud)"]
    core["crates/core<br/>(domínio puro)"]

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

**Regra inviolável:** Setas apontam para dentro. `core` nunca importa nada dos outros crates.

---

## 6. Diagrama ER — Modelo de Domínio

```mermaid
erDiagram
    Workspace ||--o{ Notebook : contém
    Notebook ||--o{ Section : contém
    Section ||--o{ Page : contém
    Page ||--o{ Block : contém
    Page ||--|| PageAnnotations : possui
    PageAnnotations ||--o{ AnchoredStroke : contém
    PageAnnotations ||--o{ HighlightAnnotation : contém
    AnchoredStroke ||--o| StrokeAnchor : ancora_em

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

## 7. Diagrama de Estado — Ciclo de Vida do App

```mermaid
stateDiagram-v2
    [*] --> Initializing: App abre

    Initializing --> RestoringSession: Carrega AppState
    RestoringSession --> WorkspacePicker: Sem workspace anterior OU erro ao abrir
    RestoringSession --> MainApp: Workspace restaurado com sucesso

    WorkspacePicker --> CreatingWorkspace: "Criar novo"
    WorkspacePicker --> OpeningWorkspace: "Abrir existente"
    WorkspacePicker --> OpeningWorkspace: Clica em recente

    CreatingWorkspace --> MainApp: Sucesso
    CreatingWorkspace --> WorkspacePicker: Erro

    OpeningWorkspace --> MainApp: Sucesso
    OpeningWorkspace --> WorkspacePicker: Erro (lock, not found)

    MainApp --> WorkspacePicker: Cmd+Shift+O

    state MainApp {
        [*] --> WelcomePage: Nenhuma page selecionada
        WelcomePage --> PageView: Seleciona page na sidebar
        PageView --> WelcomePage: Deleta última page
        PageView --> PageView: Navega para outra page

        state PageView {
            [*] --> RichTextMode
            RichTextMode --> MarkdownMode: Cmd+Shift+M
            MarkdownMode --> RichTextMode: Cmd+Shift+M
        }
    }
```

---

## 8. Diagrama de Sequência — Inicialização do App

```mermaid
sequenceDiagram
    participant User
    participant App as App.tsx
    participant UIStore as useUIStore
    participant IPC as ipc.ts
    participant Rust as src-tauri
    participant Storage as FsStorageEngine
    participant FS as Filesystem

    User->>App: Abre aplicação
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

    alt Tem last_opened_workspace
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
    else Sem workspace ou erro
        App->>UIStore: openWorkspacePicker()
        App->>App: Render WorkspacePicker
    end

    App->>App: Check onboarding flag
    App->>App: setInitializing(false)
```

---

## 9. Diagrama de Sequência — Salvar Página (Auto-Save)

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

    User->>TipTap: Digita texto
    TipTap->>TipTap: onUpdate callback
    TipTap->>Serial: tiptapToBlocks(doc, existingBlocks)
    Serial-->>TipTap: Block[]

    TipTap->>Hook: onChange(blocks)
    Hook->>Hook: Reset debounce timer (1s)

    Note over Hook: 1 segundo sem edição...

    Hook->>Store: updateBlocks(pageId, blocks)
    Store->>Store: setSaveStatus("saving")
    Store->>IPC: updatePageBlocks(pageId, blocks)
    IPC->>Rust: invoke("update_page_blocks", {page_id, blocks})

    Rust->>SC: with_page_lock(pageId)
    SC->>SC: Adquire Mutex para pageId
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

    SC->>SC: Libera Mutex
    SC-->>Rust: Page (updated)
    Rust-->>IPC: Page
    IPC-->>Store: Page
    Store->>Store: setSaveStatus("saved")
```

---

## 10. Diagrama de Sequência — Busca Full-Text

```mermaid
sequenceDiagram
    participant User
    participant Panel as SearchPanel
    participant IPC as ipc.ts
    participant Rust as src-tauri
    participant SE as SearchEngine
    participant Tantivy as Tantivy Index

    User->>Panel: Cmd+Shift+F (abre painel)
    User->>Panel: Digita "café"
    Panel->>Panel: Debounce 150ms

    Panel->>IPC: searchPages({query: "café"})
    IPC->>Rust: invoke("search_pages", {query})
    Rust->>SE: search(SearchQuery)

    SE->>SE: parse_query_lenient("café")
    SE->>Tantivy: searcher.search(query, limit)
    Tantivy->>Tantivy: AsciiFoldingFilter: "café" → "cafe"
    Tantivy->>Tantivy: Match em title (boost 2.0), content, tags (boost 1.5)
    Tantivy-->>SE: TopDocs

    SE->>SE: Gera snippets com contexto
    SE-->>Rust: SearchResults
    Rust-->>IPC: SearchResults
    IPC-->>Panel: SearchResults

    Panel->>Panel: Renderiza resultados com snippets
    User->>Panel: Clica em resultado
    Panel->>Panel: Navega para page
```

---

## 11. Diagrama de Sequência — Criar Notebook

```mermaid
sequenceDiagram
    participant User
    participant Dialog as CreateDialog
    participant Store as useWorkspaceStore
    participant IPC as ipc.ts
    participant Rust as src-tauri
    participant Storage as FsStorageEngine
    participant FS as Filesystem

    User->>Dialog: Clica "Novo Notebook"
    Dialog->>Dialog: Abre modal com input

    User->>Dialog: Digita "Estudos" + confirma
    Dialog->>Store: createNotebook("Estudos")

    Store->>IPC: createNotebook("Estudos")
    IPC->>Rust: invoke("create_notebook", {name: "Estudos"})

    Rust->>Storage: create_notebook(root, "Estudos")
    Storage->>Storage: Notebook::new("Estudos", order)
    Storage->>Storage: unique_slug("Estudos") → "estudos"
    Storage->>FS: mkdir ~/OpenNote/estudos/
    Storage->>FS: write notebook.json (atomic)
    Storage-->>Rust: Notebook
    Rust-->>IPC: Notebook
    IPC-->>Store: Notebook

    Store->>Store: Adiciona notebook à lista
    Dialog->>Dialog: Fecha modal
```

---

## 12. Diagrama de Sequência — Sync (Detecção de Mudanças)

```mermaid
sequenceDiagram
    participant SC as SyncCoordinator
    participant Manifest as SyncManifest
    participant FS as Filesystem Local
    participant Provider as CloudProvider
    participant User as UI (Conflict Dialog)

    SC->>FS: collect_local_files()
    FS-->>SC: Vec<(path, hash)>

    SC->>Provider: list_files("/")
    Provider-->>SC: Vec<RemoteFile>

    SC->>Manifest: load()
    Manifest-->>SC: HashMap<path, hash>

    loop Para cada arquivo
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
            SC->>User: Exibe conflito
            User-->>SC: ConflictResolution (KeepLocal/Remote/Both)
            SC->>SC: resolve_conflict(resolution)
        else Unchanged
            SC->>SC: Skip
        end
    end

    SC->>Manifest: save(updated_hashes)
```

---

## 13. Diagrama de Sequência — Soft Delete e Restore

```mermaid
sequenceDiagram
    participant User
    participant Sidebar as NotebookTree
    participant Store as useWorkspaceStore
    participant IPC as ipc.ts
    participant Rust as src-tauri
    participant Storage as FsStorageEngine
    participant FS as Filesystem

    User->>Sidebar: Right-click page → "Excluir"

    Sidebar->>Store: deletePage(pageId)
    Store->>IPC: deletePage(pageId)
    IPC->>Rust: invoke("delete_page", {page_id})

    Rust->>Storage: delete_page(root, pageId)
    Storage->>FS: Lê page JSON
    Storage->>Storage: Cria TrashItem com metadata
    Storage->>FS: Move page + assets → .trash/{uuid}/
    Storage->>FS: Atualiza trash_manifest.json (atomic)
    Storage-->>Rust: Ok
    Rust-->>IPC: Ok
    IPC-->>Store: Ok
    Store->>Store: Remove page da lista

    Note over User: Mais tarde...

    User->>User: Abre TrashPanel
    User->>IPC: restoreFromTrash(trashItemId)
    IPC->>Rust: invoke("restore_from_trash", {id})
    Rust->>Storage: restore_from_trash(root, id)
    Storage->>FS: Lê trash_manifest.json
    Storage->>FS: Move de .trash/{uuid}/ → path original
    Storage->>FS: Atualiza trash_manifest.json (atomic)
    Storage-->>Rust: Ok
    Rust-->>IPC: Ok
    IPC-->>User: Page restaurada
```

---

## 14. Diagrama de Sequência — Troca de Tema

```mermaid
sequenceDiagram
    participant User
    participant Settings as AppearanceSection
    participant Store as useUIStore
    participant DOM as document.documentElement
    participant IPC as ipc.ts
    participant Rust as src-tauri

    User->>Settings: Clica em "Dark"
    Settings->>Store: setTheme({baseTheme: "dark", ...})

    Store->>Store: Atualiza state.theme
    Store->>DOM: dataset.theme = "dark"
    Store->>DOM: dataset.chrome = "neutral"
    Store->>DOM: style.setProperty("--accent-*", paleta)

    Note over DOM: CSS vars ativam tema imediatamente

    Settings->>IPC: updateGlobalSettings({theme: newConfig})
    IPC->>Rust: invoke("update_global_settings", {settings})
    Rust->>Rust: Persiste em app_state.json
    Rust-->>IPC: Ok
```

---

## 15. Estrutura de Diretórios do Filesystem

```mermaid
graph TB
    subgraph "Estado Global (~/.opennote/)"
        app_state["app_state.json<br/>workspaces recentes, tema, idioma"]
    end

    subgraph "Workspace (~/OpenNote/)"
        ws_json["workspace.json"]
        lock[".lock (PID)"]

        subgraph ".trash/"
            manifest["trash_manifest.json"]
            trash_item["{uuid}/ — itens deletados"]
        end

        subgraph ".opennote/"
            index["index/ — Tantivy"]
            sync_manifest["sync_manifest.json"]
        end

        subgraph "notebook-a/"
            nb_json["notebook.json"]

            subgraph "section-1/"
                sec_json["section.json"]
                page1["aula-01.opn.json"]
                page2["aula-02.opn.json"]

                subgraph "assets/"
                    img["img-abc123.png"]
                    pdf["doc-def456.pdf"]
                end
            end
        end
    end
```

---

## Documentos Relacionados

| Documento | Conteúdo |
|---|---|
| [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) | Design do sistema — visão, princípios, modelos |
| [DATA_MODEL.md](./DATA_MODEL.md) | Modelo de dados detalhado com schemas JSON |
| [IPC_REFERENCE.md](./IPC_REFERENCE.md) | Referência completa dos 46 IPC commands |
| [GLOSSARY.md](./GLOSSARY.md) | Glossário DDD — linguagem ubíqua |

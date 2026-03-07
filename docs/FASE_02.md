# Fase 02 — Modelo de Domínio & Storage Local

## Objetivo

Definir e implementar o **modelo de domínio** do Open Note (entidades, value objects, regras) e o **mecanismo de persistência** no filesystem local. Esta fase é o coração do sistema — tudo que vier depois depende dela.

Nenhuma UI é construída aqui. O foco é **domínio puro + storage**.

---

## Dependências

- Fase 01 concluída (scaffold Tauri + estrutura de projeto)

---

## Entregáveis

1. Entidades de domínio implementadas em Rust (com testes)
2. Value Objects tipados (IDs, timestamps, posições)
3. Schema JSON versionado para cada entidade
4. Storage engine (leitura/escrita no filesystem)
5. Comandos Tauri IPC para CRUD completo
6. Testes unitários de domínio + testes de integração de storage
7. Migration strategy para evolução do schema

---

## Modelo de Domínio Detalhado

### Entidades

#### Workspace

```rust
struct Workspace {
    id: WorkspaceId,
    name: String,
    root_path: PathBuf,          // caminho absoluto no filesystem
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    settings: WorkspaceSettings,
}

struct WorkspaceSettings {
    default_notebook_id: Option<NotebookId>,
    auto_save_interval_ms: u64,  // default: 1000
    sidebar_width: u32,          // default: 260
    sidebar_open: bool,          // default: true
    last_opened_page_id: Option<PageId>,  // restaurar sessão
}
```

**Regras:**
- Um workspace = uma pasta raiz no filesystem
- Pode existir múltiplos workspaces (o app gerencia uma lista)
- O workspace não sabe sobre cloud sync (responsabilidade separada)

---

#### App State (global, fora do workspace)

O app precisa gerenciar estado **global** que transcende workspaces individuais:

```rust
/// Persistido em ~/.opennote/app_state.json
struct AppState {
    recent_workspaces: Vec<RecentWorkspace>,  // ordenados por last_opened_at DESC
    last_opened_workspace: Option<PathBuf>,
    global_settings: GlobalSettings,
}

struct RecentWorkspace {
    path: PathBuf,
    name: String,
    last_opened_at: DateTime<Utc>,
}

struct GlobalSettings {
    theme: ThemeConfig,        // global — mesmo visual em todos os workspaces
    language: Language,        // global
    window_bounds: Option<WindowBounds>,  // posição/tamanho da janela
}

struct ThemeConfig {
    base_theme: BaseTheme,     // Light, Dark, Paper, System
    accent_color: String,      // nome da paleta ("Blue", "Berry", "Teal", etc.)
    chrome_tint: ChromeTint,   // Neutral ou Tinted
}

enum BaseTheme {
    Light,   // branco limpo, moderno
    Dark,    // escuro profundo
    Paper,   // creme/sépia, visual de papel
    System,  // segue preferência do OS
}

enum ChromeTint {
    Neutral,  // sidebar/toolbar em cinza neutro
    Tinted,   // sidebar/toolbar com tonalidade da accent color
}

struct WindowBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}
```

**Regras:**
- `AppState` vive em `~/.opennote/app_state.json` (fora de qualquer workspace)
- `theme` e `language` são **globais** (removidos de `WorkspaceSettings` — ficam apenas no `GlobalSettings`)
- `WorkspaceSettings` mantém apenas preferências específicas do workspace (`default_notebook_id`, `auto_save_interval_ms`, `sidebar_width`, etc.)
- Ao abrir o app sem argumento, abrir o `last_opened_workspace`
- Se `last_opened_workspace` não existir, exibir **Workspace Picker**
- Máximo 10 workspaces recentes (LRU)

---

#### Notebook

```rust
struct Notebook {
    id: NotebookId,
    name: String,
    color: Option<Color>,
    icon: Option<String>,        // emoji ou ícone
    order: u32,                  // posição na sidebar
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}
```

**Regras:**
- Nome único dentro do workspace
- Diretório no filesystem: `{workspace_root}/{slug(name)}/`
- Metadata persiste em `notebook.json`
- Não pode ser criado sem nome
- Renomear = renomear diretório + atualizar metadata

---

#### Section

```rust
struct Section {
    id: SectionId,
    notebook_id: NotebookId,
    name: String,
    color: Option<Color>,
    order: u32,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}
```

**Regras:**
- Nome único dentro do notebook
- Diretório: `{notebook_dir}/{slug(name)}/`
- Metadata em `section.json`
- Section pode conter subdiretório `assets/` para arquivos binários

---

#### Page

```rust
struct Page {
    id: PageId,
    section_id: SectionId,
    title: String,
    tags: Vec<String>,
    blocks: Vec<Block>,
    annotations: PageAnnotations,  // camada de ink overlay (strokes + highlights)
    editor_preferences: EditorPreferences,  // preferências de edição por page
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    schema_version: u32,           // versionamento do formato
}

/// Preferências de edição por page (Fase 06)
/// Cada page lembra como o usuário prefere editá-la.
struct EditorPreferences {
    mode: EditorMode,              // RichText (padrão) ou Markdown
    split_view: bool,              // false (padrão) — split view do modo Markdown
}

enum EditorMode { RichText, Markdown }

/// Camada de anotação da page (Ink Overlay)
/// Separada dos blocos — são dados que "vivem por cima" do conteúdo.
struct PageAnnotations {
    strokes: Vec<AnchoredStroke>,
    highlights: Vec<HighlightAnnotation>,
    svg_cache: Option<String>,     // referência ao SVG pré-renderizado
}

struct AnchoredStroke {
    id: StrokeId,
    points: Vec<StrokePoint>,
    color: String,
    size: f32,
    tool: InkTool,
    opacity: f32,
    timestamp: i64,
    anchor: Option<StrokeAnchor>,  // None = coordenada absoluta
}

struct StrokeAnchor {
    block_id: BlockId,
    offset_x: f64,
    offset_y: f64,
    pdf_page: Option<u32>,         // para anotações sobre PdfBlock
}

struct StrokePoint {
    x: f64,
    y: f64,
    pressure: f32,                 // 0.0–1.0
}

struct HighlightAnnotation {
    id: AnnotationId,
    block_id: BlockId,
    start_offset: u32,
    end_offset: u32,
    color: String,
    opacity: f32,                  // default: 0.3
}

enum InkTool { Pen, Marker, Eraser }
```

**Regras:**
- Arquivo: `{section_dir}/{slug(title)}.opn.json`
- Título pode se repetir (ID é único, não o título)
- Ordem dos blocos é definida pelo campo `order` dentro de cada Block
- `schema_version` permite migrations futuras
- Page vazia é válida (blocks = [], annotations vazia)
- `annotations` é independente de `blocks` — deletar um bloco não deleta annotations automaticamente. Comportamento detalhado de annotations órfãs definido na Fase 07 (strokes convertidos para coordenada absoluta, highlights removidos)

---

#### Block

```rust
enum Block {
    Text(TextBlock),
    Markdown(MarkdownBlock),
    Code(CodeBlock),
    Checklist(ChecklistBlock),
    Table(TableBlock),
    Image(ImageBlock),
    Ink(InkBlock),
    Pdf(PdfBlock),
    Divider(DividerBlock),
    Callout(CalloutBlock),
    Embed(EmbedBlock),
}

// Serialização JSON usa snake_case via serde:
// #[serde(tag = "type", content = "data", rename_all = "snake_case")]
//
// Mapeamento enum → JSON "type":
//   Text       → "text"
//   Markdown   → "markdown"
//   Code       → "code"
//   Checklist  → "checklist"
//   Table      → "table"
//   Image      → "image"
//   Ink        → "ink"
//   Pdf        → "pdf"
//   Divider    → "divider"
//   Callout    → "callout"
//   Embed      → "embed"

struct BlockBase {
    id: BlockId,
    order: u32,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}
```

**Nesta fase, implementar apenas:**
- `TextBlock` (texto rico — HTML simplificado)
- `DividerBlock` (separador)

Os demais tipos são definidos como structs com `todo!()` no corpo.

---

### Value Objects

```rust
// IDs tipados (newtype pattern)
struct WorkspaceId(Uuid);
struct NotebookId(Uuid);
struct SectionId(Uuid);
struct PageId(Uuid);
struct BlockId(Uuid);
struct StrokeId(Uuid);
struct AnnotationId(Uuid);

// Color como value object
struct Color {
    hex: String, // #RRGGBB
}

// Enums (ver ThemeConfig, BaseTheme e ChromeTint na seção GlobalSettings acima)
enum Language { PtBr, En }
```

---

## Storage Engine

### Princípios

1. **Filesystem como banco de dados** — diretórios = entidades hierárquicas
2. **JSON para metadata e conteúdo** — legível por humanos, versionável no git
3. **Operações atômicas** — write-to-temp + rename para evitar corrupção
4. **Lazy loading** — não carregar todos os blocos de todas as pages ao abrir

### Interface (trait)

```rust
trait StorageEngine {
    // Workspace
    fn load_workspace(path: &Path) -> Result<Workspace>;
    fn save_workspace(workspace: &Workspace) -> Result<()>;
    
    // Notebook
    fn list_notebooks(workspace: &Workspace) -> Result<Vec<Notebook>>;
    fn create_notebook(workspace: &Workspace, name: &str) -> Result<Notebook>;
    fn update_notebook(notebook: &Notebook) -> Result<()>;
    fn delete_notebook(notebook_id: &NotebookId) -> Result<()>; // soft-delete → trash
    
    // Section
    fn list_sections(notebook: &Notebook) -> Result<Vec<Section>>;
    fn create_section(notebook: &Notebook, name: &str) -> Result<Section>;
    fn update_section(section: &Section) -> Result<()>;
    fn delete_section(section_id: &SectionId) -> Result<()>;    // soft-delete → trash
    
    // Page
    fn list_pages(section: &Section) -> Result<Vec<PageSummary>>;  // sem blocos
    fn load_page(page_id: &PageId) -> Result<Page>;                // com blocos
    fn create_page(section: &Section, title: &str) -> Result<Page>;
    fn update_page(page: &Page) -> Result<()>;
    fn delete_page(page_id: &PageId) -> Result<()>;               // soft-delete → trash
    fn move_page(page_id: &PageId, target_section_id: &SectionId) -> Result<Page>;

    // Assets
    fn import_asset(section_id: &SectionId, source_path: &Path) -> Result<String>; // retorna path relativo
    fn import_asset_from_bytes(section_id: &SectionId, bytes: &[u8], ext: &str) -> Result<String>;
    fn delete_asset(asset_path: &str) -> Result<()>;
    fn move_assets_with_page(page: &Page, from_section: &SectionId, to_section: &SectionId) -> Result<()>;

    // Trash
    fn list_trash_items(workspace: &Workspace) -> Result<Vec<TrashItem>>;
    fn restore_from_trash(trash_item_id: &str) -> Result<()>;
    fn permanently_delete(trash_item_id: &str) -> Result<()>;
    fn empty_trash(workspace: &Workspace) -> Result<()>;
    fn cleanup_expired_trash(workspace: &Workspace, max_age_days: u32) -> Result<u32>; // retorna qtd removida
}
```

**`PageSummary`** — versão leve da Page para listagem (sem carregar blocos):

```rust
struct PageSummary {
    id: PageId,
    title: String,
    tags: Vec<String>,
    block_count: usize,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}
```

---

### Lixeira (Soft-Delete)

Toda exclusão de Notebook, Section ou Page é um **soft-delete**: o item é movido para `.trash/` dentro do workspace, não deletado permanentemente.

**Estrutura no filesystem:**

```
~/OpenNote/
  ├── .trash/                          # Lixeira do workspace
  │    ├── trash_manifest.json          # Metadata de todos os itens na lixeira
  │    ├── {uuid}/                      # Cada item na lixeira tem um diretório
  │    │    └── ...                      # Conteúdo original preservado
  │    └── {uuid}/
  ├── meu-notebook/
  └── ...
```

**`trash_manifest.json`:**

```json
{
  "items": [
    {
      "id": "trash-uuid-1",
      "type": "page",
      "original_title": "Aula 01 — Introdução",
      "original_path": "meu-notebook/estudos/aula-01.opn.json",
      "original_notebook": "Meu Notebook",
      "original_section": "Estudos",
      "deleted_at": "2026-03-07T14:30:00Z",
      "expires_at": "2026-04-06T14:30:00Z",
      "size_bytes": 15234
    }
  ]
}
```

```rust
struct TrashItem {
    id: String,                         // UUID do item na lixeira
    item_type: TrashItemType,           // Page, Section, Notebook
    original_title: String,
    original_path: String,              // caminho relativo original
    original_notebook: String,
    original_section: Option<String>,
    deleted_at: DateTime<Utc>,
    expires_at: DateTime<Utc>,          // deleted_at + 30 dias
    size_bytes: u64,
}

enum TrashItemType { Page, Section, Notebook }
```

**Regras:**
- Retenção padrão: **30 dias** (configurável em `WorkspaceSettings`)
- Ao abrir o workspace, executar `cleanup_expired_trash()` automaticamente
- Restaurar: move de volta para o caminho original. Se o caminho não existir mais (notebook/section deletados), restaurar no nível mais próximo existente ou pedir ao usuário
- Deletar notebook com sections/pages: tudo vai para a lixeira como um único item
- "Esvaziar lixeira" = delete permanente de todos os itens
- Assets associados (imagens, PDFs, SVGs) acompanham o item para a lixeira

---

### Escrita Atômica

Para evitar corrupção de dados em caso de crash:

```
1. Serializar JSON
2. Escrever em arquivo temporário ({name}.opn.json.tmp)
3. fsync() no arquivo temporário
4. Rename atômico: .tmp → .opn.json
5. fsync() no diretório pai
```

### Workspace Lock (acesso exclusivo)

Para prevenir que dois processos Open Note abram o mesmo workspace simultaneamente (o que causaria corrupção de dados):

**Mecanismo:** Ao abrir um workspace, criar arquivo `.lock` na raiz:

```
~/OpenNote/.lock
```

```json
{
  "pid": 12345,
  "hostname": "meu-mac",
  "locked_at": "2026-03-07T14:00:00Z"
}
```

**Fluxo:**

```
open_workspace(path)
  │
  ├─ .lock existe?
  │    ├─ Sim → PID ainda está vivo? (kill -0 ou equivalente)
  │    │    ├─ Sim → Erro: "Workspace já está aberto em outro processo"
  │    │    └─ Não → Lock stale. Remover e prosseguir.
  │    └─ Não → Criar .lock → abrir normalmente
  │
  └─ Ao fechar workspace → remover .lock
```

**Regras:**
- `.lock` é criado com PID do processo atual
- Ao fechar o app (graceful shutdown), `.lock` é removido
- Se o app crashar, o `.lock` fica stale → detectado na próxima abertura via check de PID
- `.lock` é adicionado ao `.gitignore` do workspace
- `.lock` **não** é sincronizado (excluído do sync, Fase 09)

---

### Slug Generation

Para nomes de diretórios e arquivos:

```
"Aula 01 — Introdução" → "aula-01-introducao"
"Meu Notebook #1"      → "meu-notebook-1"
```

Regras:
- Lowercase
- Remover acentos (normalize NFD + strip combining)
- Substituir espaços e caracteres especiais por `-`
- Remover caracteres não-alfanuméricos
- Truncar em 64 caracteres
- Se slug duplicado, adicionar sufixo numérico (`-2`, `-3`)

---

## Comandos Tauri IPC

### Workspace

| Comando | Input | Output |
|---|---|---|
| `get_app_state` | — | `AppState` |
| `list_recent_workspaces` | — | `Vec<RecentWorkspace>` |
| `open_workspace` | `path: String` | `Workspace` |
| `create_workspace` | `path: String, name: String` | `Workspace` |
| `close_workspace` | — | `()` |
| `remove_recent_workspace` | `path: String` | `()` |
| `get_workspace_settings` | — | `WorkspaceSettings` |
| `update_workspace_settings` | `WorkspaceSettings` | `()` |
| `get_global_settings` | — | `GlobalSettings` |
| `update_global_settings` | `GlobalSettings` | `()` |

### Notebook

| Comando | Input | Output |
|---|---|---|
| `list_notebooks` | — | `Vec<Notebook>` |
| `create_notebook` | `name: String` | `Notebook` |
| `rename_notebook` | `id: NotebookId, name: String` | `Notebook` |
| `update_notebook` | `NotebookUpdate` | `Notebook` |
| `delete_notebook` | `id: NotebookId` | `()` |
| `reorder_notebooks` | `Vec<(NotebookId, u32)>` | `()` |

### Section

| Comando | Input | Output |
|---|---|---|
| `list_sections` | `notebook_id: NotebookId` | `Vec<Section>` |
| `create_section` | `notebook_id: NotebookId, name: String` | `Section` |
| `rename_section` | `id: SectionId, name: String` | `Section` |
| `delete_section` | `id: SectionId` | `()` |
| `reorder_sections` | `Vec<(SectionId, u32)>` | `()` |

### Page

| Comando | Input | Output |
|---|---|---|
| `list_pages` | `section_id: SectionId` | `Vec<PageSummary>` |
| `load_page` | `page_id: PageId` | `Page` |
| `create_page` | `section_id: SectionId, title: String` | `Page` |
| `update_page` | `PageUpdate` | `Page` |
| `delete_page` | `page_id: PageId` | `()` |
| `move_page` | `page_id: PageId, target_section_id: SectionId` | `Page` |

### Trash (Lixeira)

| Comando | Input | Output |
|---|---|---|
| `list_trash_items` | — | `Vec<TrashItem>` |
| `restore_from_trash` | `trash_item_id: String` | `()` |
| `permanently_delete` | `trash_item_id: String` | `()` |
| `empty_trash` | — | `()` |

### Assets

| Comando | Input | Output |
|---|---|---|
| `import_asset` | `section_id: SectionId, file_path: String` | `{ asset_path: String }` |
| `import_asset_from_bytes` | `section_id: SectionId, bytes: Vec<u8>, extension: String` | `{ asset_path: String }` |
| `delete_asset` | `asset_path: String` | `()` |

---

## Schema Versioning

Cada arquivo `.opn.json` contém `schema_version`:

```json
{
  "schema_version": 1,
  "id": "...",
  "title": "...",
  ...
}
```

**Estratégia de migration:**

1. Ao abrir um arquivo, checar `schema_version`
2. Se versão < atual, aplicar migrations sequenciais (v1→v2→v3...)
3. Migrations são funções puras: `fn migrate_v1_to_v2(json: Value) -> Value`
4. Após migration, salvar arquivo atualizado
5. Manter registro de migrations em `crates/storage/src/migrations/`

---

## Tratamento de Erros

```rust
#[derive(Debug, thiserror::Error)]
enum StorageError {
    #[error("Workspace não encontrado: {path}")]
    WorkspaceNotFound { path: PathBuf },
    
    #[error("Notebook já existe: {name}")]
    NotebookAlreadyExists { name: String },
    
    #[error("Section já existe: {name}")]
    SectionAlreadyExists { name: String },
    
    #[error("Page não encontrada: {id}")]
    PageNotFound { id: PageId },
    
    #[error("Schema version incompatível: esperado {expected}, encontrado {found}")]
    SchemaVersionMismatch { expected: u32, found: u32 },
    
    #[error("Erro de I/O: {source}")]
    Io { #[from] source: std::io::Error },
    
    #[error("Erro de serialização: {source}")]
    Serialization { #[from] source: serde_json::Error },
}
```

Erros do Rust são convertidos para mensagens amigáveis no frontend via serialização Tauri.

---

## TypeScript Types (geração automática)

Para manter os tipos do frontend alinhados com as structs Rust **sem drift manual**, usar a crate `ts-rs`.

**Crate:** `ts-rs` — gera arquivos `.ts` a partir de structs Rust anotadas com `#[derive(TS)]`.

```toml
[dependencies]
ts-rs = { version = "9", features = ["serde-compat"] }
```

**Uso:**

```rust
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/types/bindings/")]
struct Page {
    id: PageId,
    title: String,
    // ...
}
```

**Fluxo:**

1. Anotar todas as structs públicas (entidades, VOs, DTOs, enums) com `#[derive(TS)]`
2. Executar `cargo test` → `ts-rs` gera arquivos `.ts` em `src/types/bindings/`
3. Frontend importa os tipos gerados
4. CI verifica que os tipos gerados estão atualizados (`git diff --exit-code src/types/bindings/`)

**Estrutura gerada:**

```
src/types/bindings/
  ├── Page.ts
  ├── PageSummary.ts
  ├── Notebook.ts
  ├── Section.ts
  ├── Block.ts
  ├── WorkspaceSettings.ts
  ├── SearchQuery.ts
  ├── SearchResults.ts
  └── ...
```

**Regra:** Nenhum tipo compartilhado (Rust ↔ TS) é definido manualmente no frontend. Todos vêm de `ts-rs`.

---

## Testes

### Unitários (domínio)

- Criação de cada entidade com dados válidos
- Validação de nomes (vazio, muito longo, caracteres inválidos)
- Slug generation (acentos, caracteres especiais, duplicatas)
- Block ordering (reorder, insert, delete)
- Schema version check

### Integração (storage)

- Criar workspace → verificar diretórios e arquivos
- CRUD completo de Notebook → verificar filesystem
- CRUD completo de Section → verificar filesystem
- CRUD completo de Page → verificar filesystem
- Escrita atômica → simular crash (verificar que .tmp não corrompe)
- Migration → abrir arquivo v1 com app v2

### Fixtures

Criar diretório `tests/fixtures/` com:
- `workspace_v1/` — workspace de exemplo completo
- `page_v1.opn.json` — page no schema v1
- `page_corrupted.opn.json` — arquivo corrompido para testar error handling

---

## Definition of Done

- [ ] Todas as entidades de domínio implementadas em Rust com derive(Serialize, Deserialize)
- [ ] Value objects tipados (IDs, Color, enums)
- [ ] StorageEngine trait definida e implementada (FsStorageEngine)
- [ ] Escrita atômica implementada e testada
- [ ] Slug generation implementada e testada
- [ ] CRUD completo: Workspace, Notebook, Section, Page
- [ ] Comandos Tauri IPC expostos e tipados
- [ ] TypeScript types gerados via `ts-rs` (todas as structs públicas com `#[derive(TS)]`)
- [ ] CI verifica que bindings estão atualizados (`git diff --exit-code`)
- [ ] Lixeira (soft-delete) implementada e testada
- [ ] Asset management (import, delete, move com page) implementado
- [ ] Schema versioning com pelo menos 1 migration de exemplo
- [ ] Testes unitários de domínio passando
- [ ] Testes de integração de storage passando
- [ ] Tratamento de erros consistente
- [ ] CI verde

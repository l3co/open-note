# Modelo de Dados — Open Note

Referência consolidada de todas as entidades, tipos, schemas JSON e estrutura de armazenamento do projeto. Extraído diretamente do código em `crates/core/`.

---

## 1. Hierarquia de Conteúdo

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

Cada nível mapeia para um **diretório** no filesystem, exceto Block e Annotations que são inline no `.opn.json` da Page.

---

## 2. Entidades

### Workspace

Definido em `crates/core/src/workspace.rs`.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `WorkspaceId` (UUID) | Identificador único |
| `name` | `String` | Nome do workspace (não vazio, trimmed) |
| `root_path` | `PathBuf` | Caminho absoluto no filesystem |
| `created_at` | `DateTime<Utc>` | Data de criação |
| `updated_at` | `DateTime<Utc>` | Última atualização |
| `settings` | `WorkspaceSettings` | Configurações por workspace |

**Regras:**
- Nome não pode ser vazio nem conter apenas espaços
- Trim automático no nome

**WorkspaceSettings:**

| Campo | Tipo | Default | Descrição |
|---|---|---|---|
| `default_notebook_id` | `Option<NotebookId>` | `None` | Notebook padrão |
| `auto_save_interval_ms` | `u64` | `1000` | Intervalo do auto-save (ms) |
| `sidebar_width` | `u32` | `260` | Largura da sidebar (px) |
| `sidebar_open` | `bool` | `true` | Sidebar visível |
| `last_opened_page_id` | `Option<PageId>` | `None` | Última page aberta (restore) |

**Persistência:** `workspace.json` na raiz do workspace.

---

### Notebook

Definido em `crates/core/src/notebook.rs`.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `NotebookId` (UUID) | Identificador único |
| `name` | `String` | Nome (não vazio, trimmed) |
| `color` | `Option<Color>` | Cor hexadecimal (#rrggbb) |
| `icon` | `Option<String>` | Ícone (emoji ou nome) |
| `order` | `u32` | Posição na lista |
| `created_at` | `DateTime<Utc>` | Data de criação |
| `updated_at` | `DateTime<Utc>` | Última atualização |

**Persistência:** `notebook.json` dentro do diretório do notebook.

---

### Section

Definido em `crates/core/src/section.rs`.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `SectionId` (UUID) | Identificador único |
| `notebook_id` | `NotebookId` (UUID) | Notebook pai |
| `name` | `String` | Nome (não vazio, trimmed) |
| `color` | `Option<Color>` | Cor hexadecimal |
| `order` | `u32` | Posição na lista |
| `created_at` | `DateTime<Utc>` | Data de criação |
| `updated_at` | `DateTime<Utc>` | Última atualização |

**Persistência:** `section.json` dentro do diretório da section.

---

### Page

Definido em `crates/core/src/page.rs`.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `PageId` (UUID) | Identificador único |
| `section_id` | `SectionId` (UUID) | Section pai |
| `title` | `String` | Título (não vazio, trimmed) |
| `tags` | `Vec<String>` | Tags livres (lowercase, unique) |
| `blocks` | `Vec<Block>` | Blocos de conteúdo ordenados |
| `annotations` | `PageAnnotations` | Strokes e highlights |
| `editor_preferences` | `EditorPreferences` | Modo de edição por page |
| `created_at` | `DateTime<Utc>` | Data de criação |
| `updated_at` | `DateTime<Utc>` | Última atualização |
| `schema_version` | `u32` | Versão do schema (atual: 1) |

**Constantes:**
- `SOFT_BLOCK_LIMIT = 200` — warning no StatusBar
- `HARD_BLOCK_LIMIT = 500` — `add_block()` retorna erro

**Persistência:** `{slug}.opn.json` dentro do diretório da section.

---

### Block (Tagged Union)

Definido em `crates/core/src/block.rs`.

Todos os blocos compartilham uma base comum (`BlockBase`):

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `BlockId` (UUID) | Identificador único |
| `order` | `u32` | Posição na page |
| `created_at` | `DateTime<Utc>` | Data de criação |
| `updated_at` | `DateTime<Utc>` | Última atualização |

Serialização usa `#[serde(tag = "type", rename_all = "snake_case")]`:

#### TextBlock (`"text"`)
| Campo | Tipo | Descrição |
|---|---|---|
| `content` | `serde_json::Value` | TipTap JSON (`{ tiptap_json: { type: "doc", content: [...] } }`) |

#### MarkdownBlock (`"markdown"`)
| Campo | Tipo | Descrição |
|---|---|---|
| `content` | `String` | Texto Markdown raw |

#### CodeBlock (`"code"`)
| Campo | Tipo | Descrição |
|---|---|---|
| `language` | `Option<String>` | Linguagem (ex: "rust", "javascript") |
| `content` | `String` | Código fonte |

#### ChecklistBlock (`"checklist"`)
| Campo | Tipo | Descrição |
|---|---|---|
| `items` | `Vec<ChecklistItem>` | `{ text: String, checked: bool }` |

#### TableBlock (`"table"`)
| Campo | Tipo | Descrição |
|---|---|---|
| `rows` | `Vec<Vec<String>>` | Células como matriz de strings |
| `has_header` | `bool` | Primeira linha é header |

#### ImageBlock (`"image"`)
| Campo | Tipo | Descrição |
|---|---|---|
| `src` | `String` | Caminho relativo ao asset (ex: `"assets/img-abc.png"`) |
| `alt` | `Option<String>` | Texto alternativo |
| `width` | `Option<u32>` | Largura em pixels |
| `height` | `Option<u32>` | Altura em pixels |

#### InkBlock (`"ink"`)
| Campo | Tipo | Descrição |
|---|---|---|
| `strokes` | `Vec<serde_json::Value>` | Strokes do canvas |
| `width` | `u32` | Largura do canvas |
| `height` | `u32` | Altura do canvas |

#### PdfBlock (`"pdf"`)
| Campo | Tipo | Descrição |
|---|---|---|
| `src` | `String` | Caminho relativo ao PDF |
| `total_pages` | `u32` | Total de páginas do PDF |

#### DividerBlock (`"divider"`)
Sem campos adicionais. Apenas a base.

#### CalloutBlock (`"callout"`)
| Campo | Tipo | Descrição |
|---|---|---|
| `variant` | `CalloutVariant` | `info`, `warning`, `error`, `success`, `tip` |
| `content` | `String` | Texto do callout |

#### EmbedBlock (`"embed"`)
| Campo | Tipo | Descrição |
|---|---|---|
| `url` | `String` | URL do conteúdo embarcado |
| `title` | `Option<String>` | Título OG |
| `description` | `Option<String>` | Descrição OG |
| `thumbnail` | `Option<String>` | URL da thumbnail |

---

## 3. Anotações

Definido em `crates/core/src/annotation.rs`.

### PageAnnotations

| Campo | Tipo | Descrição |
|---|---|---|
| `strokes` | `Vec<AnchoredStroke>` | Traços de tinta (ink overlay) |
| `highlights` | `Vec<HighlightAnnotation>` | Marcações de texto |
| `svg_cache` | `Option<String>` | Caminho para cache SVG |

### AnchoredStroke

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `StrokeId` (UUID) | Identificador |
| `points` | `Vec<StrokePoint>` | Pontos `{ x: f64, y: f64, pressure: f32 }` |
| `color` | `String` | Cor hex |
| `size` | `f32` | Espessura |
| `tool` | `InkTool` | `pen`, `marker`, `eraser` |
| `opacity` | `f32` | Opacidade (0.0–1.0) |
| `timestamp` | `i64` | Timestamp Unix |
| `anchor` | `Option<StrokeAnchor>` | Ancoragem ao bloco |

### StrokeAnchor

| Campo | Tipo | Descrição |
|---|---|---|
| `block_id` | `BlockId` | Bloco alvo |
| `offset_x` | `f64` | Offset X relativo ao bloco |
| `offset_y` | `f64` | Offset Y relativo ao bloco |
| `pdf_page` | `Option<u32>` | Página do PDF (se dentro de PdfBlock) |

### HighlightAnnotation

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `AnnotationId` (UUID) | Identificador |
| `block_id` | `BlockId` | Bloco alvo |
| `start_offset` | `u32` | Offset de caractere (início) |
| `end_offset` | `u32` | Offset de caractere (fim) |
| `color` | `String` | Cor hex |
| `opacity` | `f32` | Opacidade (default 0.3) |

---

## 4. Configurações Globais

Definido em `crates/core/src/settings.rs`.

### AppState

Persistido em `~/.opennote/app_state.json`.

| Campo | Tipo | Descrição |
|---|---|---|
| `recent_workspaces` | `Vec<RecentWorkspace>` | Até 10 workspaces recentes |
| `last_opened_workspace` | `Option<PathBuf>` | Último workspace aberto |
| `global_settings` | `GlobalSettings` | Configurações globais |

### RecentWorkspace

| Campo | Tipo | Descrição |
|---|---|---|
| `path` | `PathBuf` | Caminho absoluto |
| `name` | `String` | Nome do workspace |
| `last_opened_at` | `DateTime<Utc>` | Quando foi aberto pela última vez |

### GlobalSettings

| Campo | Tipo | Default | Descrição |
|---|---|---|---|
| `theme` | `ThemeConfig` | System/Blue/Neutral | Configuração de tema |
| `language` | `Language` | `En` | Idioma (pt_br, en) |
| `window_bounds` | `Option<WindowBounds>` | `None` | Posição/tamanho da janela |

### ThemeConfig

| Campo | Tipo | Default | Descrição |
|---|---|---|---|
| `base_theme` | `BaseTheme` | `System` | `light`, `dark`, `paper`, `system` |
| `accent_color` | `String` | `"Blue"` | Nome da paleta (10 opções) |
| `chrome_tint` | `ChromeTint` | `Neutral` | `neutral`, `tinted` |

### WindowBounds

| Campo | Tipo | Descrição |
|---|---|---|
| `x` | `i32` | Posição X |
| `y` | `i32` | Posição Y |
| `width` | `u32` | Largura |
| `height` | `u32` | Altura |
| `maximized` | `bool` | Janela maximizada |

---

## 5. Lixeira (Trash)

Definido em `crates/core/src/trash.rs`.

### TrashManifest

Persistido em `.trash/trash_manifest.json`.

| Campo | Tipo | Descrição |
|---|---|---|
| `items` | `Vec<TrashItem>` | Itens na lixeira |

### TrashItem

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `String` (UUID) | Identificador do item na lixeira |
| `item_type` | `TrashItemType` | `page`, `section`, `notebook` |
| `original_title` | `String` | Título original |
| `original_path` | `String` | Path relativo original |
| `original_notebook` | `String` | Nome do notebook |
| `original_section` | `Option<String>` | Nome da section (se aplicável) |
| `deleted_at` | `DateTime<Utc>` | Quando foi deletado |
| `expires_at` | `DateTime<Utc>` | Quando expira (deleted_at + 30 dias) |
| `size_bytes` | `u64` | Tamanho em bytes |

**Constante:** `DEFAULT_TRASH_RETENTION_DAYS = 30`

---

## 6. Newtype IDs

Definido em `crates/core/src/id.rs`. Todos gerados via macro `define_id!`:

| Tipo | Wrapper | Uso |
|---|---|---|
| `WorkspaceId` | `Uuid` | Identifica workspace |
| `NotebookId` | `Uuid` | Identifica notebook |
| `SectionId` | `Uuid` | Identifica section |
| `PageId` | `Uuid` | Identifica page |
| `BlockId` | `Uuid` | Identifica block |
| `StrokeId` | `Uuid` | Identifica stroke de tinta |
| `AnnotationId` | `Uuid` | Identifica highlight |

Implementam: `Debug`, `Clone`, `Copy`, `PartialEq`, `Eq`, `Hash`, `Serialize`, `Deserialize`, `Display`, `From<Uuid>`, `TS`.

Serialização JSON: string UUID (ex: `"550e8400-e29b-41d4-a716-446655440000"`).

---

## 7. Color (Value Object)

Definido em `crates/core/src/color.rs`.

| Campo | Tipo | Validação |
|---|---|---|
| `hex` | `String` | Formato `#rrggbb` ou `#rgb`. Auto-prepend `#`. |

---

## 8. Erros

### CoreError (`crates/core/src/error.rs`)

| Variante | Campos | Descrição |
|---|---|---|
| `Validation` | `message: String` | Erro de regra de negócio (nome vazio, limite excedido) |
| `NotFound` | `entity: String, id: String` | Entidade não encontrada |

### StorageError (`crates/storage/src/error.rs`)

| Variante | Descrição |
|---|---|
| `WorkspaceNotFound` | Workspace não existe no path |
| `NotebookAlreadyExists` | Nome duplicado |
| `NotebookNotFound` | Notebook não encontrado |
| `SectionAlreadyExists` | Nome duplicado |
| `SectionNotFound` | Section não encontrada |
| `PageNotFound` | Page não encontrada por ID |
| `SchemaVersionMismatch` | Versão do schema incompatível |
| `WorkspaceLocked` | Workspace em uso por outro processo (PID) |
| `TrashItemNotFound` | Item de lixeira não encontrado |
| `Io` | Erro de I/O (from `std::io::Error`) |
| `Serialization` | Erro de JSON (from `serde_json::Error`) |
| `Core` | Erro propagado do domínio (from `CoreError`) |

---

## 9. Exemplo de `.opn.json`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "section_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "title": "Aula 01 — Introdução",
  "tags": ["estudo", "importante"],
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
              "content": [{ "type": "text", "text": "Introdução" }]
            },
            {
              "type": "paragraph",
              "content": [{ "type": "text", "text": "Primeira aula do curso." }]
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
      "content": "Lembre-se de revisar antes da prova!"
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
  "schema_version": 1
}
```

---

## 10. TypeScript Bindings

Todos os tipos Rust com `#[derive(TS)]` geram automaticamente tipos TypeScript em `src/types/bindings/`:

```
src/types/bindings/
├── AppState.ts
├── Block.ts
├── BlockBase.ts
├── CalloutVariant.ts
├── ChecklistBlock.ts
├── CodeBlock.ts
├── Color.ts
├── ... (48 arquivos no total)
├── Workspace.ts
└── WorkspaceSettings.ts
```

O CI valida que os bindings estão atualizados: `git diff --exit-code src/types/bindings/`.

---

## Documentos Relacionados

| Documento | Conteúdo |
|---|---|
| [GLOSSARY.md](./GLOSSARY.md) | Definições dos termos do domínio |
| [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) | Design do sistema |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Diagramas visuais |
| [IPC_REFERENCE.md](./IPC_REFERENCE.md) | Referência de IPC commands |

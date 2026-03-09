# Glossário — Linguagem Ubíqua do Open Note

Este glossário formaliza os termos do domínio (DDD) usados no código, documentação e comunicação do projeto. Todos os desenvolvedores devem usar estes termos de forma consistente.

---

## Hierarquia de Conteúdo

| Termo | Definição | Tipo Rust | Arquivo |
|---|---|---|---|
| **Workspace** | Container de nível mais alto. Mapeia para um diretório no filesystem que contém notebooks, configurações e dados derivados. Um usuário pode ter múltiplos workspaces. | `Workspace` | `crates/core/src/workspace.rs` |
| **Notebook** | Agrupamento dentro de um workspace. Equivalente a um "caderno" no OneNote. Mapeia para um subdiretório do workspace. Possui nome, cor, ícone e ordem. | `Notebook` | `crates/core/src/notebook.rs` |
| **Section** | Subdivisão de um notebook. Equivalente a uma "aba" ou "seção" do OneNote. Mapeia para um subdiretório do notebook. Contém pages e um diretório `assets/`. | `Section` | `crates/core/src/section.rs` |
| **Page** | Documento individual dentro de uma section. Persistido como arquivo `.opn.json`. Contém blocos, anotações, tags e preferências de editor. | `Page` | `crates/core/src/page.rs` |
| **Block** | Unidade atômica de conteúdo dentro de uma page. Tagged union com 11 variantes (text, code, checklist, table, image, ink, pdf, divider, callout, embed, markdown). Cada bloco tem ID, ordem e timestamps. | `Block` (enum) | `crates/core/src/block.rs` |

### Relação hierárquica

```
Workspace (1) → Notebook (N) → Section (N) → Page (N) → Block (N)
```

---

## Tipos de Block

| Tipo | Tag JSON | Descrição | Struct Rust |
|---|---|---|---|
| **TextBlock** | `"text"` | Texto rico armazenado como TipTap JSON (`content.tiptap_json`). Headings, parágrafos, listas, formatação inline. | `TextBlock` |
| **MarkdownBlock** | `"markdown"` | Conteúdo Markdown raw como string. | `MarkdownBlock` |
| **CodeBlock** | `"code"` | Bloco de código com language tag opcional e syntax highlighting. | `CodeBlock` |
| **ChecklistBlock** | `"checklist"` | Lista de itens com checkbox (`ChecklistItem { text, checked }`). | `ChecklistBlock` |
| **TableBlock** | `"table"` | Tabela como `Vec<Vec<String>>` com flag `has_header`. | `TableBlock` |
| **ImageBlock** | `"image"` | Referência a asset local (`src`), com alt text e dimensões opcionais. | `ImageBlock` |
| **InkBlock** | `"ink"` | Desenho livre / handwriting. Canvas isolado com strokes e dimensões fixas. | `InkBlock` |
| **PdfBlock** | `"pdf"` | Documento PDF renderizado via pdf.js. Referência ao asset com total de páginas. | `PdfBlock` |
| **DividerBlock** | `"divider"` | Separador visual horizontal. Sem conteúdo adicional. | `DividerBlock` |
| **CalloutBlock** | `"callout"` | Destaque com variante (`info`, `warning`, `error`, `success`, `tip`) e texto. | `CalloutBlock` |
| **EmbedBlock** | `"embed"` | Conteúdo embarcado (URL, título, descrição, thumbnail). Links, vídeos, previews. | `EmbedBlock` |

---

## Anotações & Ink

| Termo | Definição | Tipo Rust |
|---|---|---|
| **PageAnnotations** | Container de anotações de uma page: strokes (desenhos), highlights (marcações de texto) e cache SVG. | `PageAnnotations` |
| **AnchoredStroke** | Traço de tinta ancorado a um bloco específico (ou em coordenadas absolutas se o bloco foi deletado). Contém pontos, cor, tamanho, ferramenta e opacidade. | `AnchoredStroke` |
| **StrokeAnchor** | Ponto de ancoragem de um stroke — referência ao bloco + offset X/Y + página PDF opcional. | `StrokeAnchor` |
| **StrokePoint** | Ponto individual de um traço com coordenadas (x, y) e pressão (pressure). | `StrokePoint` |
| **HighlightAnnotation** | Marcação de texto dentro de um bloco, definida por offsets de caractere (start/end) com cor e opacidade. | `HighlightAnnotation` |
| **InkTool** | Ferramenta de desenho: `pen`, `marker` ou `eraser`. | `InkTool` (enum) |
| **Ink Overlay** | Camada Canvas transparente sobre o conteúdo da page que permite anotar por cima do texto/imagens. Strokes são ancorados a blocos DOM. | — (conceito frontend) |
| **Ink Block** | Bloco dedicado a desenho livre, com canvas isolado e dimensões fixas. Diferente do Overlay. | `InkBlock` |

---

## Identidade & Value Objects

| Termo | Definição | Tipo Rust |
|---|---|---|
| **Newtype ID** | Padrão de tipo forte para IDs. Cada entidade tem seu próprio tipo (`PageId`, `NotebookId`, etc.) wrapping um `Uuid`. Previne mistura acidental de IDs entre entidades. | `define_id!` macro |
| **WorkspaceId** | ID único de um workspace. | `WorkspaceId(Uuid)` |
| **NotebookId** | ID único de um notebook. | `NotebookId(Uuid)` |
| **SectionId** | ID único de uma section. | `SectionId(Uuid)` |
| **PageId** | ID único de uma page. | `PageId(Uuid)` |
| **BlockId** | ID único de um bloco dentro de uma page. | `BlockId(Uuid)` |
| **StrokeId** | ID único de um stroke (traço de tinta). | `StrokeId(Uuid)` |
| **AnnotationId** | ID único de uma anotação (highlight). | `AnnotationId(Uuid)` |
| **Color** | Value object para cor hexadecimal validada (`#rrggbb` ou `#rgb`). | `Color` |
| **Slug** | String derivada do título de uma page, usada como nome de arquivo. Normalização Unicode, remoção de caracteres especiais, detecção de colisão com sufixo numérico. | `unique_slug()` |

---

## Persistência & Storage

| Termo | Definição | Localização |
|---|---|---|
| **`.opn.json`** | Formato de arquivo de page. JSON estruturado com schema versionado contendo blocks, annotations, tags e metadata. | `crates/storage/` |
| **Schema Version** | Número inteiro no JSON da page (`schema_version: 1`). Permite migração automática quando o formato evolui. | `page.rs::CURRENT_SCHEMA_VERSION` |
| **Migration** | Função pura `fn migrate_vN_to_vM(Value) -> Value` que transforma JSON de uma versão para outra. | `crates/storage/src/migrations.rs` |
| **Atomic Write** | Padrão write-to-tmp + rename + fsync para garantir que arquivos nunca fiquem em estado corrupto. | `crates/storage/src/atomic.rs` |
| **FsStorageEngine** | Engine de persistência filesystem. Implementa CRUD para todas as entidades, trash, assets e app state. Struct sem estado (métodos estáticos). | `crates/storage/src/engine.rs` |
| **Workspace Lock** | Arquivo `.lock` com PID do processo. Previne acesso concorrente ao mesmo workspace. Detecção de lock stale quando o processo não existe mais. | `crates/storage/src/lock.rs` |
| **AppState** | Estado global da aplicação persistido em `~/.opennote/app_state.json`. Contém workspaces recentes, settings globais (tema, idioma) e bounds da janela. | `crates/core/src/settings.rs` |
| **Trash (Lixeira)** | Diretório `.trash/` dentro do workspace. Soft-delete com retenção de 30 dias. `TrashManifest` rastreia itens. Expirados são removidos automaticamente. | `crates/core/src/trash.rs` |
| **TrashManifest** | Arquivo JSON (`trash_manifest.json`) que lista todos os itens na lixeira com metadata (tipo, título original, path, datas, tamanho). | `TrashManifest` |
| **Asset** | Arquivo binário (imagem, PDF, SVG de ink) associado a uma section. Armazenado em `{section}/assets/`. Acompanha a page em operações de move e delete. | `FsStorageEngine::import_asset` |

---

## Busca & Indexação

| Termo | Definição | Localização |
|---|---|---|
| **SearchEngine** | Wrapper sobre Tantivy 0.22. Indexa pages com título (boost 2.0), conteúdo, tags (boost 1.5), notebook/section info. | `crates/search/src/engine.rs` |
| **Tantivy** | Engine de busca full-text em Rust (similar ao Lucene). Usado para indexação local, sem servidor. | Dependência externa |
| **Custom Tokenizer** | Tokenizer "opennote" registrado no index: `SimpleTokenizer → RemoveLongFilter → LowerCaser → AsciiFoldingFilter`. Permite buscar "café" digitando "cafe". | `crates/search/src/schema.rs` |
| **Text Extraction** | Processo de extrair texto legível de todos os tipos de bloco para indexação. Ink, PDF e divider são ignorados. | `crates/search/src/extract.rs` |
| **QuickOpen** | Dialog (Cmd+P) para busca rápida por título de page. Usa `quick_open` do SearchEngine. | Frontend |
| **SearchPanel** | Painel lateral (Cmd+Shift+F) para busca full-text com snippets e filtros. | Frontend |
| **Snippet** | Trecho de texto ao redor do termo encontrado, exibido nos resultados de busca. | `SearchEngine::search` |

---

## Sincronização (Cloud Sync)

| Termo | Definição | Localização |
|---|---|---|
| **SyncProvider** | Trait async que define a interface para provedores de nuvem: auth, list, upload, download, delete, create_directory. | `crates/sync/src/provider.rs` |
| **SyncCoordinator** | Orquestrador workspace-scoped. Gerencia providers, preferências, detecção de mudanças e resolução de conflitos. | `crates/sync/src/coordinator.rs` |
| **SyncManifest** | Arquivo JSON que rastreia hashes SHA-256 de arquivos sincronizados. Persiste em `.opennote/sync_manifest.json`. | `crates/sync/src/manifest.rs` |
| **FileChange** | Resultado da comparação entre arquivo local e remoto. Tipos: `LocalOnly`, `RemoteOnly`, `LocalModified`, `RemoteModified`, `BothModified`, `LocalDeleted`, `Unchanged`. | `FileChangeKind` (enum) |
| **ConflictResolution** | Estratégia para resolver conflitos de sync: `KeepLocal`, `KeepRemote`, `KeepBoth` (cria cópia com sufixo). | `ConflictResolution` (enum) |
| **AuthToken** | Token OAuth2 com access_token, refresh_token opcional e data de expiração. | `AuthToken` |
| **Local-First** | Princípio: dados sempre locais primeiro. App funciona 100% offline. Sync é opt-in e nunca obrigatório. | Conceito arquitetural |
| **Cloud-Aware** | UI mostra opções de cloud desde o início (badge "Em breve"), mas nunca força. Migração local → cloud a qualquer momento. Desconectar nunca deleta dados. | Conceito de UX |

---

## Configurações & Temas

| Termo | Definição | Tipo Rust |
|---|---|---|
| **GlobalSettings** | Configurações do app (tema, idioma, bounds da janela). Persiste em `~/.opennote/app_state.json`. | `GlobalSettings` |
| **WorkspaceSettings** | Configurações por workspace (auto-save interval, sidebar width, última page aberta). Persiste em `workspace.json`. | `WorkspaceSettings` |
| **EditorPreferences** | Configurações por page (modo de edição, split view). Persiste dentro do `.opn.json` da page. | `EditorPreferences` |
| **EditorMode** | Modo de edição da page: `RichText` (TipTap) ou `Markdown` (CodeMirror). Toggle via Cmd+Shift+M. | `EditorMode` (enum) |
| **ThemeConfig** | Configuração de tema com 3 camadas: `base_theme`, `accent_color`, `chrome_tint`. | `ThemeConfig` |
| **BaseTheme** | Tema base visual: `Light`, `Dark`, `Paper` (sépia) ou `System` (segue OS). Aplicado via `data-theme` no HTML. | `BaseTheme` (enum) |
| **ChromeTint** | Tonalidade do chrome (sidebar/toolbar): `Neutral` (cinza) ou `Tinted` (colorido pela accent color via `color-mix()`). Aplicado via `data-chrome` no HTML. | `ChromeTint` (enum) |
| **Accent Color** | Cor de destaque da UI. 10 paletas disponíveis: Blue, Indigo, Purple, Berry, Red, Orange, Amber, Green, Teal, Graphite. Cada uma gera 4 variantes CSS (base, hover, subtle, onAccent). | `accent_color: String` |

---

## IPC & Arquitetura

| Termo | Definição | Localização |
|---|---|---|
| **IPC Command** | Função Rust decorada com `#[tauri::command]` que é invocável pelo frontend via `invoke()`. O projeto tem 46 commands registrados. | `src-tauri/src/commands/` |
| **AppManagedState** | Estado compartilhado do backend gerenciado pelo Tauri. Contém workspace root, SaveCoordinator, SearchEngine e SyncCoordinator — todos protegidos por `Mutex`. | `src-tauri/src/state.rs` |
| **SaveCoordinator** | Gerenciador de saves concorrentes. Mantém um `Mutex` por `PageId` para serializar operações de read-modify-write na mesma page. | `src-tauri/src/state.rs` |
| **TypeScript Bindings** | Tipos TypeScript gerados automaticamente via `ts-rs` a partir de structs/enums Rust com `#[derive(TS)]`. Exportados para `src/types/bindings/`. CI valida que estão atualizados. | `ts-rs` crate |
| **Clean Architecture** | Dependências apontam para dentro. `src-tauri → storage → core`. Domínio nunca importa frameworks. | Princípio |
| **Bounded Context** | Separação DDD em 4 contextos: Core (domínio puro), Storage (persistência), Search (indexação), Sync (nuvem). Cada um é um crate Cargo independente. | `crates/` |

---

## Frontend

| Termo | Definição | Localização |
|---|---|---|
| **Zustand Store** | Store de estado reativo. Separados por domínio: `useWorkspaceStore`, `useNavigationStore`, `usePageStore`, `useUIStore`, `useAnnotationStore`. | `src/stores/` |
| **TipTap** | Framework de editor rich text baseado em ProseMirror (v3). Extensível via nodes e marks. Usado no modo RichText. | `src/components/editor/` |
| **CodeMirror** | Editor de código (v6). Usado no modo Markdown com syntax highlighting. | `src/components/editor/MarkdownEditor.tsx` |
| **Serialization** | Camada de conversão entre `Block[]` do domínio e `JSONContent` do TipTap. `blocksToTiptap()` e `tiptapToBlocks()`. | `src/lib/serialization.ts` |
| **SlashCommandMenu** | Menu de comandos ativado ao digitar `/` no editor. 13 comandos organizados por categoria (texto, estrutura, mídia). | `src/components/editor/SlashCommandMenu.tsx` |
| **FloatingToolbar** | BubbleMenu do TipTap que aparece ao selecionar texto. Oferece formatação inline (bold, italic, link, etc.). | `src/components/editor/FloatingToolbar.tsx` |
| **Auto-Save** | Hook `useAutoSave` que debounce saves com intervalo configurável (default 1s). Flush on unmount. | `src/hooks/useAutoSave.ts` |
| **i18n** | Internacionalização via `react-i18next`. 2 idiomas: pt-BR (padrão) e en. Troca sem restart. | `src/lib/i18n.ts` |
| **Toast** | Notificação temporária via `sonner`. 4 tipos: success, error, warning, info. Hook `useToast()`. | Transversal |

---

## Limites & Regras de Negócio

| Regra | Valor | Onde é aplicada |
|---|---|---|
| **Hard Block Limit** | 500 blocos por page | `Page::add_block()` retorna erro |
| **Soft Block Limit** | 200 blocos por page | `Page::is_over_soft_limit()` — warning no StatusBar |
| **Trash Retention** | 30 dias | `TrashItem::new()` calcula `expires_at` |
| **Max Recent Workspaces** | 10 | `AppState::add_recent_workspace()` trunca |
| **Auto-Save Debounce** | 1000ms (configurável) | `WorkspaceSettings.auto_save_interval_ms` |
| **Title Validation** | Não pode ser vazio nem apenas espaços | `Page::new()`, `Notebook::new()`, `Section::new()`, `Workspace::new()` |
| **Tag Normalization** | Lowercase + trim, duplicatas ignoradas | `Page::add_tag()` |
| **Color Validation** | Hex válido (#rgb ou #rrggbb) | `Color::new()` |

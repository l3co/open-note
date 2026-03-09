# System Design — Open Note

Documento central de design do sistema. Descreve a visão, princípios, arquitetura, modelos de concorrência, persistência, busca, sincronização e segurança do Open Note.

---

## 1. Visão Geral

**Open Note** é uma aplicação desktop **local-first** para anotações, inspirada no Microsoft OneNote.

### Problema
Aplicações de anotações populares (OneNote, Notion, Evernote) armazenam dados em servidores proprietários, exigem conta, coletam telemetria e trancam o usuário em formatos fechados. O usuário não tem controle real sobre seus dados.

### Solução
Uma aplicação desktop que:
- Armazena dados no **filesystem local** em formato aberto (JSON)
- Funciona **100% offline** — nenhum servidor necessário
- Oferece **sync opcional** com provedores de nuvem (Google Drive, OneDrive, Dropbox)
- Suporta **rich text**, **Markdown**, **handwriting/ink**, **PDF** e **busca full-text**
- Roda em **macOS, Windows e Linux** (futuro: Android/iOS via Tauri v2)

### Princípios de Produto

| Princípio | Implicação técnica |
|---|---|
| **Local-first** | Dados no filesystem. App funciona offline. Sync é opt-in. |
| **Formato aberto** | JSON legível (`.opn.json`). Nenhum formato proprietário. |
| **Sem telemetria** | Zero tracking. Sem conta obrigatória. |
| **Extensível** | Arquitetura de blocos permite novos tipos sem reescrever o editor. |
| **Leve** | Binário ~5MB via Tauri (vs ~150MB Electron). |

---

## 2. Arquitetura de Alto Nível

O sistema é dividido em **3 camadas principais** com dependências apontando para dentro (Clean Architecture):

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (WebView)                      │
│  React 19 + TypeScript + TailwindCSS + Zustand            │
│  TipTap (rich text) · CodeMirror (markdown) · Canvas (ink) │
├──────────────────────────────────────────────────────────┤
│                    Tauri IPC Bridge                        │
│              46 commands tipados (Rust ↔ TS)               │
├──────────────────────────────────────────────────────────┤
│                    Backend (Rust)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Core    │  │ Storage  │  │  Search  │  │   Sync   │ │
│  │ (domínio)│  │(filesys.)│  │(Tantivy) │  │ (cloud)  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└──────────────────────────────────────────────────────────┘
         │                                    │
    Local Filesystem                    Cloud APIs
    (~/OpenNote/)               (GDrive/OneDrive/Dropbox)
```

### Regra de dependência

```
Frontend (React) ──invoke()──→ src-tauri (IPC) ──→ crates/storage ──→ crates/core
                                                ──→ crates/search  ──→ crates/core
                                                ──→ crates/sync    ──→ crates/core
```

- **`crates/core`** — Domínio puro. Zero dependências de framework. Não conhece Tauri, filesystem, HTTP ou UI.
- **`crates/storage`** — Infraestrutura de persistência. Depende de `core`. Atomic writes, lock, trash, assets, migrations.
- **`crates/search`** — Motor de busca. Depende de `core`. Tantivy, tokenizer custom, extração de texto.
- **`crates/sync`** — Sincronização cloud. Depende de `core`. Provider trait, manifest SHA-256, detecção de mudanças.
- **`src-tauri`** — Camada **fina** de IPC. Apenas parse args → call crate → serialize response. Nenhuma lógica de negócio.

---

## 3. Modelo de Domínio

### Hierarquia de conteúdo

```
Workspace (1)
 └── Notebook (N)
      └── Section (N)
           └── Page (N)
                ├── Block[] (N) — conteúdo estrutural
                └── PageAnnotations — camada de anotação (ink overlay, highlights)
```

### Entidades principais

| Entidade | Identificador | Persistência | Regras de negócio |
|---|---|---|---|
| **Workspace** | `WorkspaceId(Uuid)` | `workspace.json` na raiz | Nome não vazio, trim |
| **Notebook** | `NotebookId(Uuid)` | `notebook.json` no diretório | Nome não vazio, ordem, cor/ícone opcionais |
| **Section** | `SectionId(Uuid)` | `section.json` no diretório | Nome não vazio, pertence a um notebook |
| **Page** | `PageId(Uuid)` | `{slug}.opn.json` | Título não vazio, soft limit 200 blocos, hard limit 500 |
| **Block** | `BlockId(Uuid)` | Inline no `.opn.json` | Tagged union com 11 variantes, ordem explícita |

### Block como Tagged Union

Blocos usam `#[serde(tag = "type", rename_all = "snake_case")]` para serialização polimórfica:

```json
{
  "type": "text",
  "id": "uuid",
  "order": 0,
  "content": { "tiptap_json": { ... } }
}
```

Isso permite que o frontend identifique o tipo via `block.type` e renderize o componente correto.

> Ver [GLOSSARY.md](./GLOSSARY.md) para a lista completa de block types e suas definições.

---

## 4. Modelo de Persistência

### Estrutura no Filesystem

```
~/.opennote/                       # Estado global (fora de workspaces)
  └── app_state.json               # Workspaces recentes, tema, idioma

~/OpenNote/                        # Workspace root (exemplo)
  ├── workspace.json               # Metadata do workspace
  ├── .lock                        # Lock de processo (PID)
  ├── .trash/                      # Lixeira (soft-delete)
  │    ├── trash_manifest.json
  │    └── {uuid}/                 # Itens preservados
  ├── .opennote/                   # Dados derivados
  │    ├── index/                  # Tantivy index
  │    └── sync_manifest.json      # Hashes SHA-256 para sync
  └── meu-notebook/                # Notebook (diretório)
       ├── notebook.json
       └── estudos/                # Section (diretório)
            ├── section.json
            ├── aula-01.opn.json   # Page
            └── assets/            # Imagens, PDFs, SVGs
```

### Atomic Writes

Toda escrita de arquivo segue o padrão:

1. Serializar para JSON
2. Escrever em arquivo temporário (`{path}.tmp`)
3. `fsync()` no arquivo temporário
4. `rename()` atômico para o path final
5. `fsync()` no diretório pai

Isso garante que o arquivo nunca fica em estado corrompido, mesmo com crash ou perda de energia.

### Schema Versioning

Cada `.opn.json` contém `schema_version: N`. Quando o formato evolui:

1. Código incrementa `CURRENT_SCHEMA_VERSION`
2. Função de migração `fn migrate_vN_to_vM(Value) -> Value` é adicionada
3. Na leitura, se `schema_version < CURRENT_SCHEMA_VERSION`, migrações são aplicadas em cadeia
4. Page é re-salva com a versão atual

Migrações são **funções puras** — recebem JSON (`serde_json::Value`) e retornam JSON. Sem efeitos colaterais.

### Slug Generation

Nomes de arquivo de pages são gerados via slug:

1. Normalização Unicode (NFD → NFC)
2. Lowercase
3. Caracteres especiais → hífen
4. Múltiplos hífens → um
5. Detecção de colisão → sufixo numérico (`aula-01-2.opn.json`)

---

## 5. Modelo de Concorrência

### Workspace Lock

Ao abrir um workspace, o app cria `.lock` contendo o PID do processo:

- Se `.lock` existe e o PID está ativo → `WorkspaceLocked` error
- Se `.lock` existe e o PID não está ativo → lock stale, removido automaticamente
- Ao fechar o workspace → `.lock` é removido

Previne que duas instâncias do app corrompam o mesmo workspace.

### SaveCoordinator (Mutex per-Page)

O backend mantém um `HashMap<PageId, Mutex<()>>` para serializar writes na mesma page:

```rust
pub struct SaveCoordinator {
    page_locks: Mutex<HashMap<PageId, Arc<Mutex<()>>>>,
}
```

**Fluxo de save (read-modify-write):**

1. Frontend envia `update_page_blocks(page_id, blocks)`
2. SaveCoordinator adquire lock da page
3. Lê page atual do filesystem
4. Substitui blocos
5. Escreve via atomic write
6. Libera lock

Isso previne race conditions quando múltiplos saves chegam em sequência rápida (ex: auto-save + save manual).

### AppManagedState

Estado compartilhado do backend, gerenciado pelo Tauri:

```rust
pub struct AppManagedState {
    pub workspace_root: Mutex<Option<PathBuf>>,
    pub save_coordinator: SaveCoordinator,
    pub search_engine: Mutex<Option<SearchEngine>>,
    pub sync_coordinator: Mutex<Option<SyncCoordinator>>,
}
```

Cada recurso é protegido por `Mutex`. O padrão `Option` permite que recursos sejam inicializados sob demanda (ex: SearchEngine só existe após abrir um workspace).

---

## 6. Modelo de Busca

### Tantivy (Full-Text Search)

O SearchEngine usa Tantivy 0.22 com:

**Schema:**
| Campo | Tipo | Boost | Tokenizer |
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

**Custom Tokenizer "opennote":**
```
SimpleTokenizer → RemoveLongFilter → LowerCaser → AsciiFoldingFilter
```

O `AsciiFoldingFilter` permite buscar "café" digitando "cafe", essencial para conteúdo em português.

### Indexação

- **Incremental:** Cada save de page chama `index_page()` que remove o documento anterior e insere o novo.
- **Text extraction:** Texto é extraído de todos os block types (text, markdown, code, checklist, table, image alt, callout, embed). Ink, PDF e divider são ignorados.
- **Rebuild:** `rebuild_index()` re-indexa todas as pages do workspace. Usado para recovery.
- **Consistency:** `reader.reload()` é chamado após cada commit para garantir que buscas retornem resultados imediatos.

### Duas interfaces de busca

| Interface | Shortcut | Uso | Engine method |
|---|---|---|---|
| **QuickOpen** | Cmd+P | Busca por título | `quick_open(query)` |
| **SearchPanel** | Cmd+Shift+F | Full-text com snippets | `search(SearchQuery)` |

---

## 7. Modelo de Sincronização

### Princípio: Local-First, Cloud-Aware

```
Local Workspace ←──sync──→ Cloud Provider
    (sempre)                  (opt-in)
```

O sync nunca é obrigatório. Desconectar nunca deleta dados (ambas as cópias permanecem).

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

3 providers implementados como stubs: GoogleDrive, OneDrive, Dropbox. Retornam `AuthRequired` até que OAuth clients sejam configurados.

### Detecção de Mudanças

O SyncManifest persiste hashes SHA-256 de cada arquivo sincronizado. Na comparação:

| Local | Manifest | Remote | Resultado |
|---|---|---|---|
| Existe | Não existe | — | `LocalOnly` → upload |
| — | Existe | Existe | `RemoteOnly` → download |
| Hash ≠ manifest | — | Hash = manifest | `LocalModified` → upload |
| Hash = manifest | — | Hash ≠ manifest | `RemoteModified` → download |
| Hash ≠ manifest | — | Hash ≠ manifest | `BothModified` → conflito |
| Não existe | Existe | — | `LocalDeleted` |

### Resolução de Conflitos

3 estratégias:
- **KeepLocal** — versão local sobrescreve remota
- **KeepRemote** — versão remota sobrescreve local
- **KeepBoth** — cria cópia com sufixo (ex: `page-conflict-2026-03-09.opn.json`)

---

## 8. Frontend — State Management

### Zustand Stores

| Store | Responsabilidade | Dados |
|---|---|---|
| `useWorkspaceStore` | Workspace, notebooks, sections CRUD | workspace, notebooks[], sections[] |
| `useNavigationStore` | Seleção, expand/collapse, histórico | selectedNotebook/Section/Page, history[] |
| `usePageStore` | Page CRUD, save status | currentPage, saveStatus |
| `useUIStore` | Sidebar, tema, modais, search/sync panels | sidebarOpen, theme, showSettings, etc. |
| `useAnnotationStore` | Ink strokes e highlights da page atual | strokes[], highlights[], currentTool |

### Fluxo de Dados (unidirecional)

```
User Action → Store Action → IPC invoke() → Rust Backend → Filesystem
                                                    ↓
                                              Result/Error
                                                    ↓
                                         Store Update → React Re-render
```

### Serialization Layer

O frontend mantém uma camada de serialização entre o domínio (Block[]) e o editor (TipTap JSONContent):

- **`blocksToTiptap(blocks)`** — Converte `Block[]` para TipTap `JSONContent`. TextBlocks viram nodes TipTap. DividerBlocks viram `horizontalRule`. Non-text blocks são preservados fora do TipTap.
- **`tiptapToBlocks(doc, existingBlocks)`** — Converte de volta, preservando IDs e blocos non-text.

---

## 9. Editor Architecture

### Dual-Mode Editor

Cada page pode ser editada em 2 modos, alternáveis via Cmd+Shift+M:

| Modo | Engine | Uso |
|---|---|---|
| **RichText** | TipTap v3 (ProseMirror) | WYSIWYG com toolbar flutuante e slash commands |
| **Markdown** | CodeMirror 6 | Edição raw com syntax highlighting |

A conversão entre modos usa a serialization layer:
```
RichText Mode ←→ TipTap JSON ←→ Block[] ←→ Markdown string ←→ Markdown Mode
```

### TipTap Extensions

| Extension | Origem | Função |
|---|---|---|
| StarterKit | @tiptap/starter-kit | Heading, paragraph, lists, blockquote, history |
| CodeBlockLowlight | @tiptap/extension-code-block-lowlight | Syntax highlighting |
| Table + Row + Cell + Header | @tiptap/extension-table-* | Tabelas editáveis, resizable |
| TaskList + TaskItem | @tiptap/extension-task-list | Checklists |
| Image | @tiptap/extension-image | Imagens inline |
| Underline | @tiptap/extension-underline | Formatação underline |
| Link | @tiptap/extension-link | Links clicáveis |
| Typography | @tiptap/extension-typography | Tipografia inteligente |
| CharacterCount | @tiptap/extension-character-count | Contagem de caracteres |
| Placeholder | @tiptap/extension-placeholder | Placeholder per-node |
| Callout | Custom extension | Blocos de destaque (5 variantes) |

### Auto-Save

```
User types → TipTap onChange → tiptapToBlocks() → useAutoSave (debounce 1s) → IPC update_page_blocks
```

O `useAutoSave` hook:
- Debounce configurável (default 1s via `WorkspaceSettings.auto_save_interval_ms`)
- `forceSave()` para flush imediato (ex: antes de navegar para outra page)
- Cleanup on unmount (flush pendente)
- Flag `enabled` para desabilitar temporariamente

---

## 10. Sistema de Temas (3 Camadas)

### Camada 1 — Base Theme
Define cores de fundo, texto, bordas, superfícies:

| Tema | Estilo | Inspiração |
|---|---|---|
| `light` | Branco limpo | Notion, Linear |
| `paper` | Creme/sépia | Kindle, iA Writer |
| `dark` | Escuro profundo | VS Code, Obsidian |
| `system` | Segue o OS | — |

Aplicado via `<html data-theme="dark">`.

### Camada 2 — Accent Color
10 paletas com 4 variantes cada: `base`, `hover`, `subtle` (10% opacity), `onAccent` (texto).

Paletas: Blue, Indigo, Purple, Berry, Red, Orange, Amber, Green, Teal, Graphite.

### Camada 3 — Chrome Tint
Define a tonalidade da sidebar e toolbar:

| Tint | Efeito |
|---|---|
| `neutral` | Cinza neutro |
| `tinted` | Tonalidade da accent color via `color-mix()` |

Aplicado via `<html data-chrome="tinted">`.

### Persistência
`GlobalSettings.theme → ThemeConfig { base_theme, accent_color, chrome_tint }`

Persiste em `~/.opennote/app_state.json`. Restaurado no startup.

---

## 11. Internacionalização (i18n)

- **Engine:** react-i18next
- **Idiomas:** pt-BR (padrão), en
- **Chaves:** 250+ strings traduzidas
- **Troca:** Sem restart — `i18n.changeLanguage()` re-renderiza tudo
- **Regra:** Nenhuma string visível hardcoded. Tudo via `t('key')`.
- **Erros do backend:** Backend retorna código de erro (ex: `NOTEBOOK_ALREADY_EXISTS`). Frontend traduz via i18n.

---

## 12. Segurança

| Aspecto | Implementação |
|---|---|
| **Sem telemetria** | Zero tracking, zero analytics, zero phone-home |
| **Sem conta** | App funciona sem nenhuma autenticação |
| **Tauri Capabilities** | Permissões granulares por janela (`capabilities/default.json`) |
| **Workspace Lock** | `.lock` com PID previne corrupção por acesso concorrente |
| **Atomic Writes** | Escrita nunca corrompe arquivo existente |
| **No eval/exec** | Frontend não executa código dinâmico |
| **OAuth2** | Tokens de sync armazenados localmente, nunca transmitidos para terceiros |
| **Dados locais** | Sem servidor intermediário. Sync é direto app ↔ cloud provider |

---

## 13. Limites e Trade-offs

| Aspecto | Limite | Razão |
|---|---|---|
| **Blocos por page** | Soft 200, Hard 500 | Performance do editor. Virtualização futura. |
| **Workspaces recentes** | Máximo 10 | UX — lista gerenciável |
| **Trash retention** | 30 dias | Espaço em disco |
| **Sync** | File-level, não block-level | Simplicidade. CRDT é futuro. |
| **PDF** | Renderização apenas (sem edição) | Escopo v1. pdf.js é read-only. |
| **Mobile** | Não suportado (v1) | Tauri v2 suporta, mas escopo é desktop. |
| **Global undo** | Não existe cross-page | Limitação v1. Lixeira mitiga o caso crítico. |
| **Real-time collab** | Não existe | Fora de escopo. Requer CRDT/OT. |

---

## 14. Decisões Arquiteturais (ADRs)

Decisões registradas formalmente em `docs/adr/`:

| ADR | Decisão |
|---|---|
| [001](./adr/001-tauri-v2.md) | Tauri v2 como runtime desktop |
| [002](./adr/002-cargo-workspace.md) | Cargo workspace com crates por bounded context |
| [003](./adr/003-tiptap-editor.md) | TipTap v3 como editor rich text |
| [004](./adr/004-tantivy-search.md) | Tantivy como engine de busca local |
| [005](./adr/005-zustand-state.md) | Zustand como state management |
| [006](./adr/006-theme-system.md) | Sistema de temas 3 camadas |
| [007](./adr/007-local-first.md) | Estratégia local-first cloud-aware |
| [008](./adr/008-ink-hybrid.md) | Ink híbrido (Overlay + Block) |
| [009](./adr/009-i18n-strategy.md) | react-i18next para i18n |

---

## 15. Documentos Relacionados

| Documento | Conteúdo |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Diagramas Mermaid (C4, sequência, ER, estado) |
| [DATA_MODEL.md](./DATA_MODEL.md) | Modelo de dados detalhado com schemas JSON |
| [IPC_REFERENCE.md](./IPC_REFERENCE.md) | Referência completa dos 46 IPC commands |
| [GLOSSARY.md](./GLOSSARY.md) | Glossário DDD — linguagem ubíqua |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Guia de desenvolvimento |
| [TESTING.md](./TESTING.md) | Estratégia de testes |
| [BUILD_AND_DEPLOY.md](./BUILD_AND_DEPLOY.md) | Build, release, distribuição |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Problemas comuns e soluções |

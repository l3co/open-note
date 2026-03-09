# Open Note — Project Memories

## Identidade

Open Note é um app desktop **local-first** de anotações, inspirado no Microsoft OneNote.
Formato aberto (JSON), dados no filesystem, sem lock-in, sem telemetria, sem conta obrigatória.

- **Repositório:** https://github.com/l3co/open-note
- **Licença:** MIT
- **Versão:** 0.1.0

---

## Stack Técnica

| Camada | Tecnologia | Versão |
|---|---|---|
| Runtime | Tauri v2 | 2.x |
| Frontend | React + TypeScript | 19.x / 5.x |
| Styling | TailwindCSS v4 | 4.x |
| State | Zustand | 5.x |
| Editor Rich Text | TipTap v3 (ProseMirror) | 3.x |
| Editor Markdown | CodeMirror 6 | 6.x |
| Ink | Canvas API + perfect-freehand | 1.x |
| PDF | pdfjs-dist | 5.x |
| Backend | Rust (stable 1.94+) | — |
| Storage | Filesystem local (JSON) | — |
| Busca | Tantivy | 0.22 |
| Sync | Google Drive, OneDrive, Dropbox (OAuth2, opt-in) | — |
| Testes Frontend | Vitest + Testing Library + MSW | 3.x |
| Testes E2E | Playwright | 1.x |
| Testes Rust | cargo test + insta | — |
| Icons | Lucide React | — |
| i18n | react-i18next | — |
| Toasts | sonner | — |

---

## Estrutura do Projeto (Cargo Workspace)

```
open-note/
├── crates/
│   ├── core/       # Domínio puro — SEM dependência de Tauri/frameworks
│   ├── storage/    # Filesystem, atomic writes, lock, trash, assets, migrations
│   ├── search/     # Tantivy — indexação e busca full-text
│   └── sync/       # Cloud sync (Google Drive, OneDrive, Dropbox)
├── src-tauri/      # Camada FINA de IPC (Tauri v2) — delega para crates
│   └── src/
│       ├── main.rs
│       ├── lib.rs          # Registro dos 46 IPC commands
│       ├── commands/       # Handlers IPC por módulo
│       └── state.rs        # AppManagedState, SaveCoordinator
├── src/            # Frontend React + TypeScript
│   ├── components/ # Componentes por domínio (editor/, layout/, settings/, etc.)
│   ├── stores/     # Zustand (5 stores)
│   ├── hooks/      # useAutoSave, useKeyboardShortcuts
│   ├── lib/        # ipc.ts, serialization.ts, theme.ts, i18n.ts, markdown.ts
│   ├── locales/    # pt-BR.json, en.json (250+ chaves cada)
│   ├── styles/     # CSS global
│   └── types/      # bindings/ (gerados por ts-rs) + search.ts, sync.ts
├── e2e/            # Testes E2E Playwright (54 testes)
├── docs/           # Documentação completa (README.md é o hub central)
├── site/           # Landing page estática
└── Cargo.toml      # Workspace root
```

---

## Modelo de Domínio

### Hierarquia

```
Workspace → Notebook → Section → Page → Block
```

### Tipos de Block (11)

`text`, `markdown`, `code`, `checklist`, `table`, `image`, `ink`, `pdf`, `divider`, `callout`, `embed`

Serialização: `#[serde(tag = "type", rename_all = "snake_case")]`

### IDs

Newtype pattern: `struct PageId(Uuid)` — nunca `String` raw.

### Formato de Arquivo

- Pages: `{slug}.opn.json` — schema versionado
- Metadata: `notebook.json`, `section.json`, `workspace.json`
- Assets: `assets/` por section
- Global: `~/.opennote/app_state.json`
- Lixeira: `.trash/` com soft-delete, retenção 30 dias
- Índice: `.opennote/index/` (Tantivy, dados derivados)

---

## Regras de Dependência (Invioláveis)

```
src-tauri → crates/storage → crates/core
src-tauri → crates/search  → crates/core
src-tauri → crates/sync    → crates/core
```

- **`crates/core`** é domínio puro — NÃO importa Tauri, serde_json, filesystem, frameworks
- **`src-tauri/`** é camada fina — delega para crates, nunca contém lógica de negócio
- **Frontend** nunca acessa filesystem — sempre via IPC commands

---

## IPC Commands (46 total)

| Módulo | Qty | Arquivo |
|---|---|---|
| App | 2 | `commands/mod.rs` |
| Workspace | 8 | `commands/workspace.rs` |
| Notebook | 5 | `commands/notebook.rs` |
| Section | 5 | `commands/section.rs` |
| Page | 7 | `commands/page.rs` |
| File I/O | 2 | `commands/page.rs` |
| PDF | 1 | `commands/page.rs` |
| Tags | 1 | `commands/tags.rs` |
| Trash | 4 | `commands/trash.rs` |
| Assets | 3 | `commands/assets.rs` |
| Search | 5 | `commands/search.rs` |
| Sync | 6 | `commands/sync.rs` |

TypeScript wrappers: `src/lib/ipc.ts`
Referência completa: `docs/IPC_REFERENCE.md`

---

## Zustand Stores (5)

| Store | Responsabilidade |
|---|---|
| `useWorkspaceStore` | Workspace, notebooks, sections CRUD |
| `useNavigationStore` | Seleção, expand/collapse, histórico back/forward |
| `usePageStore` | Page atual, save status, blocks |
| `useUIStore` | Sidebar, tema, modais, workspace picker |
| `useAnnotationStore` | Ink strokes, highlights |

---

## Sistema de Temas (3 camadas)

1. **Base Theme:** light, dark, paper, system
2. **Accent Color:** 10 paletas (Blue→Graphite)
3. **Chrome Tint:** neutral, tinted

Aplicado via `<html data-theme="dark" data-chrome="tinted">` + CSS custom properties.

---

## Testes

| Camada | Ferramenta | Quantidade |
|---|---|---|
| Rust unit + integration | cargo test | 177+ |
| Frontend unit | Vitest + Testing Library | 129+ |
| E2E | Playwright | 54 |

Coverage targets: core 90%, storage 85%, frontend 80% lines / 70% branches.

---

## Convenções

### Código
- Rust: `snake_case` funções, `PascalCase` tipos, `thiserror` para erros, nunca `unwrap()` em produção
- TypeScript: `camelCase` variáveis, `PascalCase` componentes, imports `@/` absolutos
- i18n: toda string visível via `t('key')`, nunca hardcoded
- TypeScript bindings: `#[derive(TS)]` em structs expostas → `src/types/bindings/`

### Commits
Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `style:`, `perf:`

### Idioma
- Comunicação: Português (PT-BR)
- Código: Inglês

---

## Fases do Projeto

| Fase | Tema | Status |
|---|---|---|
| 01 | Fundação (scaffold, tooling, CI) | ✅ Concluída |
| 02 | Modelo de Domínio & Storage Local | ✅ Concluída |
| 03 | UI Shell & Navegação | ✅ Concluída |
| 04 | Rich Text Editor (TipTap) | ✅ Concluída |
| 05 | Blocos Avançados | ✅ Concluída |
| 06 | Export & Import | ✅ Concluída |
| 07 | Ink & PDF | ✅ Concluída |
| 08 | Busca Full-Text | ✅ Concluída |
| 09 | Cloud Sync | ✅ Concluída |
| 10 | Settings, Onboarding & Polish | ✅ Concluída |

---

## ADRs (9 decisões)

| ADR | Decisão |
|---|---|
| 001 | Tauri v2 como runtime desktop |
| 002 | Cargo workspace com crates por bounded context |
| 003 | TipTap v3 como editor rich text |
| 004 | Tantivy como engine de busca local |
| 005 | Zustand como state management |
| 006 | Sistema de temas com 3 camadas |
| 007 | Estratégia local-first cloud-aware |
| 008 | Ink híbrido (Overlay + Block) |
| 009 | react-i18next para i18n |

---

## Documentação

Hub central: `docs/README.md`

| Documento | Conteúdo |
|---|---|
| `docs/SYSTEM_DESIGN.md` | Design do sistema completo |
| `docs/ARCHITECTURE.md` | Diagramas Mermaid (C4, sequência, ER, estado) |
| `docs/DATA_MODEL.md` | Modelo de dados, schemas JSON, bindings |
| `docs/GLOSSARY.md` | Glossário DDD — linguagem ubíqua |
| `docs/IPC_REFERENCE.md` | Referência dos 46 IPC commands |
| `docs/DEVELOPMENT.md` | Guia de setup e desenvolvimento |
| `docs/TESTING.md` | Estratégia de testes |
| `docs/BUILD_AND_DEPLOY.md` | Build, release, CI/CD |
| `docs/TROUBLESHOOTING.md` | Problemas comuns e soluções |
| `CONTRIBUTING.md` | Guia de contribuição |
| `docs/adr/` | 9 ADRs |
| `ROADMAP.md` | Visão, fases, riscos |

---

## Comandos Essenciais

```bash
# Dev
npm run tauri dev          # App completo com hot reload
npm run dev                # Apenas frontend (Vite :1420)

# Testes
cargo test --workspace     # Rust (177+ testes)
npm run test               # Frontend (129+ testes)
npm run test:e2e           # E2E Playwright (54 testes)
npm run test:all           # Rust + Frontend

# Lint & Format
cargo fmt --check --all
cargo clippy --workspace -- -D warnings
npm run lint               # ESLint
npm run format:check       # Prettier
npm run typecheck          # TypeScript

# Build
npm run tauri build        # Build de produção
cargo test -p opennote-core # Regenera TypeScript bindings
```

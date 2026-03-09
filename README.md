# Open Note

Local-first note-taking app inspired by Microsoft OneNote. Rich text, Markdown, handwriting, PDF annotation, and cloud sync — all with your data on your filesystem.

[![CI](https://github.com/l3co/open-note/actions/workflows/ci.yml/badge.svg)](https://github.com/l3co/open-note/actions/workflows/ci.yml)

## Features

- **Rich text editor** — TipTap (ProseMirror) with headings, lists, blockquote, code blocks (syntax highlighting), tables, checklists, images, callouts, embeds, and a slash command menu
- **Markdown mode** — CodeMirror 6 with live toggle (Cmd+Shift+M), bidirectional conversion RichText ↔ Markdown
- **Handwriting & ink** — Canvas API + perfect-freehand with InkOverlay (annotate over text) and InkBlock (dedicated drawing area)
- **PDF viewer** — pdfjs-dist with in-page rendering and pagination
- **Full-text search** — Tantivy engine with QuickOpen (Cmd+P) and SearchPanel (Cmd+Shift+F), accent folding, snippet highlighting
- **Cloud sync** — Google Drive, OneDrive, Dropbox (opt-in, stubs — OAuth not yet configured)
- **Premium themes** — 3-layer system: base theme (Light/Paper/Dark/System) × 10 accent colors × chrome tint (Neutral/Tinted)
- **i18n** — Portuguese (PT-BR) and English, switchable without restart
- **Open format** — `.opn.json` files on your filesystem, no lock-in, no telemetry

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Tauri v2 (desktop; mobile future) |
| **Frontend** | React 19 + TypeScript + TailwindCSS v4 |
| **State** | Zustand |
| **Rich Text** | TipTap v3 (ProseMirror) |
| **Markdown** | CodeMirror 6 |
| **Ink** | Canvas API + perfect-freehand |
| **PDF** | pdfjs-dist |
| **Backend** | Rust (Cargo workspace) |
| **Storage** | Local filesystem (JSON), atomic writes |
| **Search** | Tantivy 0.22 |
| **Sync** | Google Drive, OneDrive, Dropbox (OAuth2, opt-in) |
| **Tests** | Vitest, Testing Library, MSW, Playwright, cargo test, insta |
| **Icons** | Lucide React |

## Prerequisites

- **Node.js** 23+ (see `.nvmrc`)
- **Rust** stable (see `rust-toolchain.toml`)
- **Tauri CLI** v2: `cargo install tauri-cli --version "^2"`
- **macOS:** Xcode Command Line Tools
- **Linux:** `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
- **Windows:** WebView2, Visual Studio Build Tools

## Setup

```bash
# Clone
git clone https://github.com/l3co/open-note.git
cd open-note

# Install frontend dependencies
npm install

# Run in development mode (opens desktop app with hot reload)
cargo tauri dev
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server (port 1420) |
| `npm run build` | TypeScript check + production build |
| `npm run test` | Run frontend tests (Vitest) |
| `npm run test:watch` | Frontend tests in watch mode |
| `npm run test:coverage` | Frontend tests with coverage report |
| `npm run test:e2e` | Run E2E tests (Playwright) |
| `npm run test:rust` | Run Rust tests (`cargo test --workspace`) |
| `npm run test:all` | Run all tests (Rust + frontend) |
| `npm run lint` | ESLint (frontend) |
| `npm run lint:rust` | Rustfmt + Clippy |
| `npm run lint:all` | All linters |
| `npm run format` | Format with Prettier |
| `npm run typecheck` | TypeScript type check |
| `cargo tauri dev` | Run desktop app in dev mode |
| `cargo tauri build` | Build production binary |

## Project Structure

```
open-note/
├── crates/
│   ├── core/           # Domain — entities, rules, validations (pure Rust, no frameworks)
│   ├── storage/        # Filesystem — atomic writes, lock, trash, assets, migrations
│   ├── search/         # Tantivy — full-text indexing and search
│   └── sync/           # Cloud sync — providers, manifest, conflict resolution
├── src-tauri/          # Tauri v2 — thin IPC layer (46 commands), delegates to crates
│   └── src/
│       ├── commands/   # IPC handlers (workspace, notebook, section, page, search, sync, etc.)
│       └── state.rs    # AppManagedState, SaveCoordinator
├── src/                # Frontend — React + TypeScript
│   ├── components/     # UI (editor, sidebar, settings, search, ink, pdf, sync, onboarding)
│   ├── stores/         # Zustand (workspace, navigation, page, UI)
│   ├── hooks/          # useAutoSave, useKeyboardShortcuts
│   ├── lib/            # IPC wrapper, serialization, markdown conversion, theme utils
│   ├── locales/        # i18n (pt-BR.json, en.json)
│   └── types/          # TypeScript types + ts-rs bindings
├── e2e/                # Playwright E2E tests
├── docs/               # Phase specs (FASE_01–10) + ADRs
├── retrofit_e2e/       # E2E test planning documents
└── retrofit_test_rust/ # Rust test retrofit planning documents
```

### Architecture

**Clean Architecture + DDD.** Dependencies point inward:

```
src (React) → src-tauri (IPC) → crates/storage → crates/core
                               → crates/search  → crates/core
                               → crates/sync    → crates/core
```

- **`crates/core`** — Pure domain. No Tauri, no filesystem, no frameworks.
- **`crates/storage`** — Infrastructure. Atomic JSON writes, workspace lock (.lock + PID), soft-delete trash (.trash/), slug generation, schema migrations.
- **`crates/search`** — Tantivy index with custom tokenizer (ASCII folding, lowercase).
- **`crates/sync`** — Provider trait + stubs, SHA-256 manifest, file-level conflict resolution.
- **`src-tauri`** — Thin IPC layer. 46 commands. Delegates all logic to crates.

### Domain Model

```
Workspace → Notebook → Section → Page → Block[]
```

Block types: `text`, `code`, `checklist`, `table`, `image`, `ink`, `pdf`, `divider`, `callout`, `embed`

Pages are stored as `{slug}.opn.json` with versioned schema.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+\` | Toggle sidebar |
| `Cmd+P` | Quick Open (search by title) |
| `Cmd+Shift+F` | Search Panel (full-text) |
| `Cmd+Shift+M` | Toggle Rich Text / Markdown |
| `Cmd+Shift+O` | Workspace Picker |
| `Cmd+[` / `Cmd+]` | Navigate back / forward |
| `Cmd+B` | Bold |
| `Cmd+I` | Italic |
| `Cmd+U` | Underline |
| `/` | Slash command menu (13 commands) |

## Documentation

**[📚 Documentation Hub](./docs/README.md)** — Central index with all project documentation.

### Design & Architecture
- [System Design](./docs/SYSTEM_DESIGN.md) — Vision, principles, concurrency, persistence, search, sync, security
- [Architecture Diagrams](./docs/ARCHITECTURE.md) — Mermaid diagrams (C4, sequence, ER, state)
- [Data Model](./docs/DATA_MODEL.md) — Entities, block types, JSON schemas, TypeScript bindings
- [Glossary](./docs/GLOSSARY.md) — DDD ubiquitous language

### API & Reference
- [IPC Reference](./docs/IPC_REFERENCE.md) — All 46 IPC commands (Rust ↔ TypeScript)

### Development
- [Development Guide](./docs/DEVELOPMENT.md) — Setup, workflow, conventions, how-to guides
- [Testing Strategy](./docs/TESTING.md) — Test pyramid, coverage targets, CI pipeline
- [Build & Deploy](./docs/BUILD_AND_DEPLOY.md) — Build, release, CI/CD, code signing
- [Contributing](./CONTRIBUTING.md) — Contribution workflow, PR checklist
- [Troubleshooting](./docs/TROUBLESHOOTING.md) — Common problems and solutions

### Decisions & Planning
- [ADRs](./docs/adr/) — 9 Architecture Decision Records (001–009)
- [ROADMAP.md](./ROADMAP.md) — Vision, domain model, phases, risks
- [Phase docs](./docs/) — Detailed specs for each phase (FASE_01–10)

## License

MIT
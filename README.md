# Open Note

A local-first desktop note-taking app — rich text, Markdown, handwriting, PDF annotation, and cloud sync, all stored as plain files on your filesystem.

[![CI](https://github.com/l3co/open-note/actions/workflows/ci.yml/badge.svg)](https://github.com/l3co/open-note/actions/workflows/ci.yml)

---

## Getting Started

**Prerequisites:** Node.js 23+ · Rust stable · macOS Xcode CLT / Linux `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf` / Windows WebView2 + VS Build Tools

```bash
git clone https://github.com/l3co/open-note.git
cd open-note
npm install
cargo tauri dev   # opens the app with hot reload
```

---

## Features

**Writing**
- Rich text editor (TipTap / ProseMirror) — headings, lists, tables, code blocks, checklists, callouts, embeds, slash commands
- Markdown mode (CodeMirror 6) — live toggle with `Cmd+Shift+M`, bidirectional conversion with rich text

**Drawing & Documents**
- Ink overlay — annotate over any content with a freehand canvas layer
- Ink blocks — dedicated drawing areas inside pages
- PDF viewer — render and annotate PDFs inline with ink

**Organization & Search**
- Hierarchy: Workspace → Notebook → Section → Page
- Full-text search (Tantivy) — `Cmd+P` quick open, `Cmd+Shift+F` panel, accent folding, snippet preview
- Multi-workspace — open multiple workspaces simultaneously

**Sync & Storage**
- Files stored as `.opn.json` on your filesystem — no lock-in, no telemetry
- Cloud sync with Google Drive, OneDrive, and Dropbox (opt-in, OAuth2)
- Atomic writes — crash-safe saves at all times

**Appearance & i18n**
- Three-layer theme system: base (Light / Paper / Dark / System) × 10 accent colors × chrome tint
- English and Portuguese (PT-BR), switchable without restart

---

## Architecture

```
src/ (React)  →  src-tauri/ (IPC)  →  crates/storage  →  crates/core
                                    →  crates/search   →  crates/core
                                    →  crates/sync     →  crates/core
```

- **`crates/core`** — Pure domain layer. Entities, value objects, validation. No I/O, no frameworks.
- **`crates/storage`** — Filesystem persistence. Atomic JSON writes, workspace locking, soft-delete trash, schema migrations.
- **`crates/search`** — Full-text search via Tantivy with a custom tokenizer (ASCII folding, lowercase).
- **`crates/sync`** — Cloud sync. Provider trait, OAuth2, SHA-256 manifest, file-level conflict resolution.
- **`src-tauri`** — Thin IPC layer. ~50 `#[tauri::command]` handlers that delegate to the crates above.

Built with **Tauri v2** (Rust backend, WebView frontend), **React 19 + TypeScript**, and **TailwindCSS v4**.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+\` | Toggle sidebar |
| `Cmd+P` | Quick Open |
| `Cmd+Shift+F` | Search Panel |
| `Cmd+Shift+M` | Toggle Rich Text / Markdown |
| `Cmd+Shift+O` | Workspace Picker |
| `Cmd+[` / `Cmd+]` | Navigate back / forward |
| `/` | Slash command menu |

---

## Documentation

| Document | Description |
|---|---|
| [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) | Setup, daily workflow, conventions, how-to guides |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | C4 diagrams, sequence diagrams, ER model |
| [docs/SYSTEM_DESIGN.md](./docs/SYSTEM_DESIGN.md) | Vision, principles, concurrency, persistence, search, sync |
| [docs/DATA_MODEL.md](./docs/DATA_MODEL.md) | Entities, block types, JSON schemas, TypeScript bindings |
| [docs/IPC_REFERENCE.md](./docs/IPC_REFERENCE.md) | All IPC commands (Rust ↔ TypeScript) |
| [docs/TESTING.md](./docs/TESTING.md) | Test pyramid, coverage targets, CI pipeline |
| [docs/BUILD_AND_DEPLOY.md](./docs/BUILD_AND_DEPLOY.md) | Production builds, CI/CD, release process |
| [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) | Common problems and solutions |
| [docs/adr/](./docs/adr/) | Architecture Decision Records (ADR-001 to ADR-009) |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute |
| [ROADMAP.md](./ROADMAP.md) | Product vision and upcoming priorities |

---

## License

MIT

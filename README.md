# Open Note

Local-first note-taking app inspired by Microsoft OneNote. Rich text, Markdown, handwriting, PDF annotation, and cloud sync — all with your data on your filesystem.

[![CI](https://github.com/l3co/open-note/actions/workflows/ci.yml/badge.svg)](https://github.com/l3co/open-note/actions/workflows/ci.yml)

## Features (planned)

- Rich text editing (TipTap/ProseMirror)
- Native Markdown mode (CodeMirror 6)
- Handwriting & ink annotations (Canvas + perfect-freehand)
- PDF import & annotation
- Full-text search (Tantivy)
- Cloud sync (Google Drive, OneDrive, Dropbox) — opt-in
- Open format (`.opn.json`) — no lock-in

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
| `npm run dev` | Start Vite dev server |
| `npm run build` | TypeScript check + production build |
| `npm run test` | Run frontend tests (Vitest) |
| `npm run test:coverage` | Frontend tests with coverage report |
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
│   ├── core/       # Domain (entities, rules, validations)
│   ├── storage/    # Filesystem, atomic writes, trash
│   ├── search/     # Tantivy full-text search
│   └── sync/       # Cloud sync engine
├── src-tauri/      # Tauri v2 IPC layer (thin)
├── src/            # React + TypeScript frontend
├── e2e/            # Playwright E2E tests
└── docs/           # Phase docs + ADRs
```

**Architecture:** Clean Architecture with DDD. Domain lives in `crates/core` (pure Rust, no framework dependencies). `src-tauri/` is a thin IPC layer that delegates to crates.

## Documentation

- [ROADMAP.md](./ROADMAP.md) — Vision, domain model, phases, risks
- [Phase docs](./docs/) — Detailed specs for each phase (FASE_01–10)
- [ADR-001](./docs/adr/001-tauri-v2.md) — Why Tauri v2
- [ADR-002](./docs/adr/002-cargo-workspace.md) — Why Cargo workspace

## License

MIT
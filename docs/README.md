# Documentation — Open Note

Central index for all project documentation. Start here to find the right document.

---

## Design & Architecture

| Document | Description |
|---|---|
| [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md) | Vision, principles, concurrency model, persistence, search, sync, and security |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Mermaid diagrams — C4 (context, containers, components), ER, state machines, sequence |
| [DATA_MODEL.md](./DATA_MODEL.md) | Domain entities, block types, JSON schemas, TypeScript bindings |
| [GLOSSARY.md](./GLOSSARY.md) | DDD ubiquitous language — definitions used throughout the codebase |

## API Reference

| Document | Description |
|---|---|
| [IPC_REFERENCE.md](./IPC_REFERENCE.md) | All IPC commands (Rust ↔ TypeScript) with parameters and return types |

## Development

| Document | Description |
|---|---|
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Setup, daily workflow, conventions, how-to guides (new IPC command, new block type, new translation, OAuth credentials) |
| [TESTING.md](./TESTING.md) | Test pyramid, coverage targets, Vitest, Playwright, cargo test, CI pipeline |
| [BUILD_AND_DEPLOY.md](./BUILD_AND_DEPLOY.md) | Dev and production builds, CI/CD, release flow, code signing |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common problems and solutions |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Contribution workflow, commit convention, PR checklist |

## Architecture Decision Records

| ADR | Decision | Status |
|---|---|---|
| [001 — Tauri v2](./adr/001-tauri-v2.md) | Tauri v2 as the desktop runtime | Accepted |
| [002 — Cargo Workspace](./adr/002-cargo-workspace.md) | Cargo workspace with bounded-context crates | Accepted |
| [003 — TipTap Editor](./adr/003-tiptap-editor.md) | TipTap v3 as the rich text editor | Accepted |
| [004 — Tantivy Search](./adr/004-tantivy-search.md) | Tantivy as the local full-text search engine | Accepted |
| [005 — Zustand State](./adr/005-zustand-state.md) | Zustand for frontend state management | Accepted |
| [006 — Theme System](./adr/006-theme-system.md) | Three-layer theme system | Accepted |
| [007 — Local-First](./adr/007-local-first.md) | Local-first, cloud-aware strategy | Accepted |
| [008 — Ink Hybrid](./adr/008-ink-hybrid.md) | Hybrid ink (Overlay + Block) | Accepted |
| [009 — i18n Strategy](./adr/009-i18n-strategy.md) | react-i18next for internationalization | Accepted |

## Planning

| Document | Description |
|---|---|
| [../ROADMAP.md](../ROADMAP.md) | Product vision, what's built, what's next, non-goals |

---

## Quick Reference

| I need to… | Where to look |
|---|---|
| Set up the project | [DEVELOPMENT.md — Setup](./DEVELOPMENT.md#2-initial-setup) |
| Understand the domain | [GLOSSARY.md](./GLOSSARY.md) |
| See the architecture | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Add an IPC command | [DEVELOPMENT.md — New IPC Command](./DEVELOPMENT.md#adding-an-ipc-command) |
| Add a block type | [DEVELOPMENT.md — New Block Type](./DEVELOPMENT.md#adding-a-block-type) |
| Add a translation | [DEVELOPMENT.md — i18n](./DEVELOPMENT.md#adding-a-translation) |
| Configure OAuth credentials | [DEVELOPMENT.md — OAuth Setup](./DEVELOPMENT.md#oauth-credentials) |
| Run tests | [TESTING.md](./TESTING.md) |
| Debug a problem | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |
| Understand an architecture decision | [ADRs](./adr/) |
| Look up an IPC command | [IPC_REFERENCE.md](./IPC_REFERENCE.md) |
| Understand the data format | [DATA_MODEL.md](./DATA_MODEL.md) |
| Build for production | [BUILD_AND_DEPLOY.md](./BUILD_AND_DEPLOY.md) |
| Contribute | [../CONTRIBUTING.md](../CONTRIBUTING.md) |

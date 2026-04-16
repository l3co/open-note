# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Open Note is a local-first desktop note-taking app (Tauri v2) with a React/TypeScript frontend and a Rust backend. Data is stored as `.opn.json` files on the user's filesystem — no database, no telemetry.

## Commands

```bash
# Dev (full app with hot reload — preferred)
npm run tauri dev       # or: cargo tauri dev

# Frontend only (IPC calls will fail)
npm run dev

# Build
npm run build           # TypeScript check + Vite production build
cargo tauri build       # Production binary

# Tests
npm run test            # Vitest (frontend unit)
npm run test:watch      # Vitest watch mode
npm run test:coverage   # Vitest + coverage report
npm run test:e2e        # Playwright E2E
npm run test:rust       # cargo test --workspace
npm run test:all        # Rust + frontend

# Single test
cargo test -p opennote-core -- page::tests::create_page_with_valid_title
npx vitest run src/lib/__tests__/serialization.test.ts
npx playwright test e2e/fase-03-ui-shell.spec.ts

# Lint & format
npm run lint:all        # ESLint + rustfmt --check + clippy
npm run format          # Prettier auto-fix
cargo fmt --all         # Rust format

# TypeScript bindings (regenerate after changing Rust types)
cargo test -p opennote-core   # writes to src/types/bindings/
```

## Architecture

Clean Architecture — dependencies point inward only:

```
src/ (React) → src-tauri/ (IPC) → crates/storage → crates/core
                                 → crates/search  → crates/core
                                 → crates/sync    → crates/core
```

**Rust crates:**
- `crates/core` — Pure domain. Entities, value objects, validation. No Tauri, no I/O.
- `crates/storage` — Filesystem layer. Atomic JSON writes, workspace lock (`.lock` + PID), soft-delete trash (`.trash/`), slug generation, schema migrations.
- `crates/search` — Tantivy full-text index with custom tokenizer (ASCII folding, lowercase). Index lives at `{workspace}/.opennote/index/`.
- `crates/sync` — Provider trait + OAuth stubs (Google Drive, OneDrive, Dropbox), SHA-256 manifest, file-level conflict resolution.
- `src-tauri/` — Thin IPC layer. 46 `#[tauri::command]` handlers that delegate to the crates above.

**Frontend (`src/`):**
- `stores/` — 5 Zustand stores by domain: `useWorkspaceStore`, `useNavigationStore`, `usePageStore`, `useUIStore`, `useMultiWorkspaceStore`.
- `lib/ipc.ts` — Typed wrappers over `invoke()` for all 46 commands.
- `lib/serialization.ts` — Bidirectional conversion between `Block[]` (domain) and TipTap/ProseMirror JSON.
- `components/editor/` — TipTap v3 rich text + CodeMirror 6 Markdown mode.
- `components/ink/` — Canvas API + perfect-freehand (excluded from test coverage — jsdom limitation).

**Domain model:**
```
Workspace → Notebook → Section → Page → Block[]
```
Block types: `text`, `code`, `checklist`, `table`, `image`, `ink`, `pdf`, `divider`, `callout`, `embed`.
Pages are stored as `{slug}.opn.json` with a versioned schema.

**AppManagedState** (`src-tauri/src/state.rs`) — Tauri managed state holding up to 10 open `WorkspaceContext` instances (each with its own `SearchEngine` and `SyncCoordinator`) plus a `SaveCoordinator` that per-page-locks concurrent writes.

## Key conventions

### Rust
- IDs use newtype pattern: `struct PageId(Uuid)` — never raw `String`.
- Every struct/enum exposed to the frontend must `#[derive(TS)]` from `ts-rs`; run `cargo test -p opennote-core` to regenerate `src/types/bindings/`.
- No `unwrap()` in production code — use `thiserror`-based typed errors.
- Block `type` discriminant uses `#[serde(tag = "type", rename_all = "snake_case")]`.
- Unit tests are inline `#[cfg(test)]`; integration tests go in `crates/*/tests/`.

### TypeScript / React
- All user-visible strings must go through `t('key')` from `react-i18next` (both `src/locales/pt-BR.json` and `src/locales/en.json`).
- Import alias `@/` maps to `src/`.
- Styling is TailwindCSS v4 utility-first; theme vars are CSS custom properties.
- E2E selectors use `data-testid` — never rely on text or CSS classes for Playwright queries.

### Adding an IPC command
1. Add logic to the appropriate crate (`core` for domain, `storage` for filesystem).
2. Create handler in `src-tauri/src/commands/<module>.rs` using `#[tauri::command]`.
3. Register it in `src-tauri/src/lib.rs` inside `tauri::generate_handler![]`.
4. Add typed wrapper in `src/lib/ipc.ts`.
5. If the return type is new, add `#[derive(TS)]` and regenerate bindings.

### Adding a block type
1. Define struct in `crates/core/src/block.rs` + add variant to `Block` enum.
2. Update `crates/search/src/extract.rs` for text extraction.
3. Update `src/lib/serialization.ts` (`blocksToTiptap` + `tiptapToBlocks`).
4. Add serialization roundtrip test and search extraction test.

## Test infrastructure

- **Vitest** — jsdom environment, globals enabled, setup at `src/test/setup.ts` (mocks `window.__TAURI_INTERNALS__` IPC + `window.matchMedia`).
- **Playwright E2E** — runs against `npm run dev` (port 1420). IPC is mocked via `page.addInitScript()` in `e2e/helpers/ipc-mock.ts`; no Tauri binary needed.
- Coverage thresholds enforced: 80% lines / 70% branches (frontend); 90% lines for `crates/core`.
- CI verifies bindings are up-to-date via `git diff --exit-code src/types/bindings/`.

## Commit convention

Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.

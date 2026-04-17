# Development Guide — Open Note

Complete guide for setting up the environment, understanding the project structure, and contributing code.

---

## 1. Prerequisites

| Tool | Minimum version | Check |
|---|---|---|
| **Rust** | stable (see `rust-toolchain.toml`) | `rustc --version` |
| **Node.js** | 23.x (see `.nvmrc`) | `node --version` |
| **npm** | 10.x | `npm --version` |
| **Tauri CLI** | 2.x | `npx tauri --version` |
| **Git** | 2.x | `git --version` |

**System dependencies:**

macOS:
```bash
xcode-select --install
```

Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev librsvg2-dev patchelf libssl-dev libgtk-3-dev libayatana-appindicator3-dev
```

Windows: Visual Studio Build Tools (C++ workload) + WebView2 (included in Windows 11, manual install on Windows 10)

---

## 2. Initial Setup

```bash
git clone https://github.com/l3co/open-note.git
cd open-note
npm ci
cargo build --workspace

# Verify everything works
cargo test --workspace
npm run test
npm run lint
npm run typecheck
```

---

## 3. Daily Development Workflow

**Full app with hot reload (preferred):**
```bash
npm run tauri dev
```
This starts Vite on port 1420 (frontend HMR) and Tauri (Rust backend, recompiles on save).

**Frontend only (IPC calls will fail):**
```bash
npm run dev
```

**Command reference:**

| Command | Description |
|---|---|
| `npm run tauri dev` | Full app with hot reload |
| `npm run dev` | Vite dev server only (port 1420) |
| `npm run build` | TypeScript check + production frontend build |
| `npm run test` | Frontend unit tests (Vitest) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with coverage report |
| `npm run test:e2e` | E2E tests (Playwright) |
| `npm run test:rust` | Rust tests (`cargo test --workspace`) |
| `npm run test:all` | Rust + frontend tests |
| `npm run lint` | ESLint (frontend) |
| `npm run lint:rust` | `cargo fmt --check` + `cargo clippy` |
| `npm run lint:all` | All linters |
| `npm run format` | Prettier auto-fix |
| `npm run format:check` | Prettier check only |
| `npm run typecheck` | TypeScript type check |
| `cargo tauri build` | Production binary |

**Running a single test:**
```bash
# Rust
cargo test -p opennote-core -- page::tests::create_page_with_valid_title

# Frontend
npx vitest run src/lib/__tests__/serialization.test.ts

# E2E
npx playwright test e2e/fase-03-ui-shell.spec.ts
```

---

## 4. Project Structure

```
open-note/
├── crates/                    # Rust — Cargo workspace
│   ├── core/                  # Pure domain (entities, rules, validations — no I/O)
│   ├── storage/               # Filesystem (atomic writes, lock, trash, migrations)
│   ├── search/                # Tantivy (indexing, full-text search)
│   └── sync/                  # Cloud sync (providers, manifest, conflict resolution)
├── src-tauri/                 # Tauri app (thin IPC layer)
│   └── src/
│       ├── commands/          # ~50 IPC handlers (delegate to crates)
│       ├── state.rs           # AppManagedState, SaveCoordinator
│       ├── lib.rs             # Command registration + plugin setup
│       └── main.rs            # Entry point
├── src/                       # Frontend — React + TypeScript
│   ├── components/            # React components grouped by domain
│   │   ├── editor/            # TipTap, markdown, toolbar, slash menu
│   │   ├── ink/               # Canvas, ink overlay, ink block
│   │   ├── pdf/               # PDF viewer
│   │   ├── search/            # QuickOpen, SearchPanel
│   │   ├── settings/          # Settings dialog
│   │   ├── sidebar/           # NotebookTree, WorkspaceSwitcher
│   │   ├── sync/              # Cloud sync UI
│   │   └── workspace/         # WorkspacePicker
│   ├── hooks/                 # useAutoSave, useKeyboardShortcuts
│   ├── lib/                   # ipc.ts, serialization.ts, theme.ts, i18n.ts
│   ├── locales/               # pt-BR.json, en.json
│   ├── stores/                # Zustand stores (5 stores by domain)
│   └── types/                 # TypeScript types + ts-rs generated bindings
├── e2e/                       # Playwright E2E tests
└── docs/                      # Documentation
```

---

## 5. Code Conventions

**Rust:**
- IDs use newtype pattern: `struct PageId(Uuid)` — never raw `String`
- No `unwrap()` in production code — use `thiserror`-based typed errors
- Block `type` discriminant: `#[serde(tag = "type", rename_all = "snake_case")]`
- Every struct/enum exposed to frontend must `#[derive(TS)]`
- Unit tests are inline `#[cfg(test)]`; integration tests in `crates/*/tests/`

**TypeScript / React:**
- All user-visible strings through `t('key')` from `react-i18next`
- Import alias `@/` maps to `src/`
- Styling: TailwindCSS v4 utility-first; theme vars are CSS custom properties
- E2E selectors use `data-testid` — never text or CSS classes in Playwright

**Commits:** Conventional Commits — `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`

---

## 6. Adding an IPC Command

1. Add logic to the appropriate crate (`core` for domain, `storage` for filesystem).
2. Create handler in `src-tauri/src/commands/<module>.rs`:

```rust
#[tauri::command]
pub fn my_command(
    state: tauri::State<AppManagedState>,
    param: String,
) -> Result<MyType, String> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::my_method(&root, &param).map_err(|e| e.to_string())
}
```

3. Register in `src-tauri/src/lib.rs` inside `tauri::generate_handler![]`.
4. Add typed wrapper in `src/lib/ipc.ts`:

```typescript
export const myCommand = (param: string) =>
  invoke<MyType>("my_command", { param });
```

5. If the return type is new, add `#[derive(TS)]` and regenerate bindings:

```bash
cargo test -p opennote-core  # writes to src/types/bindings/
```

---

## 7. Adding a Block Type

1. Define struct in `crates/core/src/block.rs` + add variant to the `Block` enum.
2. Update `crates/search/src/extract.rs` for text extraction.
3. Update `src/lib/serialization.ts` (`blocksToTiptap` + `tiptapToBlocks`).
4. Add serialization roundtrip test and search extraction test.

---

## 8. Adding a Translation

Add the key to both locale files:

```json
// src/locales/en.json
{ "myComponent": { "title": "My Title" } }

// src/locales/pt-BR.json
{ "myComponent": { "title": "Meu Título" } }
```

Use in the component:
```tsx
const { t } = useTranslation();
return <h1>{t('myComponent.title')}</h1>;
```

---

## 9. OAuth Credentials

Cloud sync (Google Drive, OneDrive, Dropbox) requires OAuth2 credentials embedded at build time via `option_env!()`. Never commit them to the repository.

**For local development**, create `.env.local` in the project root (gitignored):

```bash
# Google Drive — console.cloud.google.com
export GOOGLE_CLIENT_ID="xxxxx.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxxxx"

# Dropbox — dropbox.com/developers/apps
export DROPBOX_CLIENT_ID="xxxxxxxxxxxxxxx"
export DROPBOX_CLIENT_SECRET="xxxxxxxxxxxxxxxxxxxxxxx"

# OneDrive — portal.azure.com (client ID only, no secret for public clients)
export ONEDRIVE_CLIENT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Then source it before running:
```bash
source .env.local && npm run tauri dev
```

**Redirect URI:** All providers use `http://localhost:19876/callback`

| Provider | Needs explicit registration? |
|---|---|
| Google Drive (Desktop app) | No — `localhost` is implicitly allowed |
| Dropbox | Yes — add in the app's Settings tab |
| OneDrive | Configured automatically as a Public client |

**For CI/CD**, inject via GitHub Actions secrets:
```yaml
env:
  GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
  GOOGLE_CLIENT_SECRET: ${{ secrets.GOOGLE_CLIENT_SECRET }}
  DROPBOX_CLIENT_ID: ${{ secrets.DROPBOX_CLIENT_ID }}
  DROPBOX_CLIENT_SECRET: ${{ secrets.DROPBOX_CLIENT_SECRET }}
  ONEDRIVE_CLIENT_ID: ${{ secrets.ONEDRIVE_CLIENT_ID }}
```

---

## 10. TypeScript Bindings

Bindings are auto-generated by `ts-rs` when Rust tests run:
```bash
cargo test -p opennote-core  # regenerates src/types/bindings/
```

CI enforces that bindings are up to date via `git diff --exit-code src/types/bindings/`.

---

## Related Documents

| Document | Content |
|---|---|
| [TESTING.md](./TESTING.md) | Detailed test strategy |
| [BUILD_AND_DEPLOY.md](./BUILD_AND_DEPLOY.md) | Build, release, distribution |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Contribution guide |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common problems and solutions |
| [IPC_REFERENCE.md](./IPC_REFERENCE.md) | IPC command reference |

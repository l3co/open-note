# Contributing to Open Note

Thank you for your interest in contributing. This guide covers everything you need to get started.

---

## Prerequisites

- **Rust** stable (see `rust-toolchain.toml`)
- **Node.js** 23+ (see `.nvmrc`)
- **Tauri CLI** v2: `cargo install tauri-cli --version "^2"`

```bash
git clone https://github.com/l3co/open-note.git
cd open-note
npm ci
cargo build --workspace
```

---

## Workflow

### 1. Open an issue first (for large changes)

Before starting a significant feature or refactor, open an issue to discuss the approach. This avoids wasted work and ensures the change aligns with the project direction.

### 2. Create a branch

```bash
git checkout -b feat/my-feature   # new feature
git checkout -b fix/my-bug        # bug fix
git checkout -b docs/update       # documentation
```

### 3. Make your changes

Follow the conventions in [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md). Run checks before committing:

```bash
npm run test:all     # Rust + frontend tests
npm run lint:all     # ESLint + rustfmt + clippy
npm run typecheck    # TypeScript
```

### 4. Commit with Conventional Commits

```
feat: add export to PDF
fix: handle empty page title gracefully
docs: update IPC reference
refactor: extract slug generation to core crate
test: add roundtrip tests for serialization
chore: update dependencies
```

### 5. Open a pull request

- Target the `main` branch
- Include a short description of what changed and why
- Link the related issue if one exists

---

## PR Checklist

- [ ] Tests pass (`npm run test:all`)
- [ ] Linters pass (`npm run lint:all`)
- [ ] New IPC commands registered in `src-tauri/src/lib.rs` and `src/lib/ipc.ts`
- [ ] New user-visible strings use `t('key')` and are added to both locale files
- [ ] TypeScript bindings regenerated if Rust types changed (`cargo test -p opennote-core`)

---

## Good First Issues

Look for issues tagged [`good first issue`](https://github.com/l3co/open-note/issues?q=is%3Aopen+label%3A%22good+first+issue%22) on GitHub. These are scoped, well-defined tasks with enough context to get started without deep knowledge of the codebase.

---

## Questions

Open a [GitHub Discussion](https://github.com/l3co/open-note/discussions) or comment on an existing issue.

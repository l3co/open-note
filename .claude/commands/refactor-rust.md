---
description: Refactor Rust — analyzes the entire backend and generates a refactoring plan in docs/
---

Activated by the `/refactor-rust` command. Analyzes all Rust code in the project (all workspace crates) as a Rust systems expert, and generates structured refactoring planning documentation — **without implementing any code changes**.

## Focus areas

- **Ownership & Memory** — lifetime issues, unnecessary Arc/Rc, avoidable clones
- **Error Handling** — `unwrap()`/`expect()` in production code, untyped errors, inconsistent propagation
- **Async/Concurrency** — incorrect Tokio patterns, blocking in async context, race conditions
- **Type System** — missing newtype patterns, misused traits, excessive or insufficient generics
- **Performance** — unnecessary allocations, avoidable copies, sub-optimal algorithms
- **API Design** — Clean Architecture violations, cross-crate coupling, non-ergonomic interfaces
- **Testing** — insufficient coverage, fragile tests, absence of property-based tests
- **Clippy / Idioms** — non-idiomatic code, known Clippy lints

---

## Steps

### 1. Get the current date

```bash
date +%Y-%m-%d
```

Save the result as `{DATE}` (e.g. `2026-03-12`).

---

### 2. Check if the output directory already exists

```bash
ls /Users/leco/RustroverProjects/open-note/docs/ | grep refactor-rust
```

If `refactor-rust-{DATE}` already exists, add a `-v2` suffix.

---

### 3. Create the output directory

```bash
mkdir -p /Users/leco/RustroverProjects/open-note/docs/refactor-rust-{DATE}
```

---

### 4. Scan the full Rust workspace

Read and analyze **all** relevant Rust files as an expert. Do not skip files.

#### 4.1 — Map the workspace

```bash
cat /Users/leco/RustroverProjects/open-note/Cargo.toml
```

```bash
find /Users/leco/RustroverProjects/open-note/crates -name "Cargo.toml" | sort
```

```bash
cat /Users/leco/RustroverProjects/open-note/src-tauri/Cargo.toml
```

#### 4.2 — Crate `crates/core` (Domain)

Evaluate:
- Rich vs. anemic domain models
- Business invariants expressed in types (newtype pattern)
- Prohibited external dependencies (core must NOT import serde_json, tokio, or Tauri)
- Typed errors with `thiserror` in all modules
- Unit tests covering business rules

#### 4.3 — Crate `crates/storage` (Infrastructure)

Evaluate:
- Atomic writes and I/O error handling
- `unwrap()`/`expect()` in filesystem operations
- Versioned migrations as pure functions
- Trait abstractions for testability (dependency injection)
- Integration tests with a real filesystem

#### 4.4 — Crate `crates/search` (Tantivy)

Evaluate:
- Tantivy index management (lock, flush, rebuild)
- Indexing errors propagated correctly
- Query performance and batching
- Integration tests with a real index

#### 4.5 — Crate `crates/sync` (Cloud Sync)

Evaluate:
- Async patterns with Tokio (no blocking in async context)
- Network error handling (retry, backoff, timeout)
- Provider trait for testability (cloud provider mocks)
- Race conditions in concurrent sync

#### 4.6 — `src-tauri` (IPC Layer)

Evaluate:
- IPC commands as a **thin** layer (delegate to crates, no business logic)
- `AppManagedState` and shared state management
- Errors returned to the frontend with typed codes
- TypeScript bindings via `ts-rs` present on all exposed structs

#### 4.7 — General metrics

```bash
find /Users/leco/RustroverProjects/open-note/crates /Users/leco/RustroverProjects/open-note/src-tauri -name "*.rs" | grep -v "target" | wc -l
```

Count `unwrap`/`expect` calls outside tests:
```bash
grep -rn "unwrap()\|\.expect(" /Users/leco/RustroverProjects/open-note/crates /Users/leco/RustroverProjects/open-note/src-tauri/src --include="*.rs" | grep -v "#\[cfg(test)\]" | wc -l
```

Count `.clone()` calls:
```bash
grep -rn "\.clone()" /Users/leco/RustroverProjects/open-note/crates --include="*.rs" | wc -l
```

---

### 5. Generate `roadmap.md`

Create `docs/refactor-rust-{DATE}/roadmap.md` with:
- Overall diagnosis summary
- Issues found per category with severity (🔴 CRITICAL / 🟠 HIGH / 🟡 MEDIUM / 🟢 LOW)
- Crates with the highest concentration of issues
- Complexity assessment (score X/10 with justification)
- Phased refactoring strategy ordered from domain → infrastructure → IPC
- Acceptance criteria (Definition of Done)

---

### 6. Generate `fase_1.md` (and additional phases)

For **each phase**, create `docs/refactor-rust-{DATE}/fase_0X.md` with:
- Objective (what this phase fixes and why it's critical)
- Current context with **real code snippets** from the project files
- Specific tasks with problem + proposed solution in actual Rust code
- Files modified / not modified in this phase
- Phase acceptance criteria

**Recommended phase order:**
1. `crates/core` — error handling, domain invariants, dependency isolation
2. `crates/storage` — atomic writes, I/O handling, testability via traits
3. `crates/search` + `crates/sync` — async patterns, retry/backoff, provider mocks
4. `src-tauri` — correct delegation, complete ts-rs bindings, typed errors for frontend
5. (if needed) Performance — avoidable clones, allocations, algorithms

---

### 7. Verify generated files

```bash
ls -la /Users/leco/RustroverProjects/open-note/docs/refactor-rust-{DATE}/
```

---

### 8. Summarize the diagnosis

Present to the user:
- The directory created in `docs/`
- Total number of issues found per category and per crate
- The 3–5 most critical issues with exact location (crate, file, line)
- List of phases with target crate(s), effort estimate, and priority
- Total effort estimate
- Ask if there are scope or phase prioritization adjustments

---

## Important Notes

- **NEVER implement code** — this workflow only generates planning.
- **Use real code** — when describing problems, include real snippets from files actually read. Never invent generic examples.
- **Respect the dependency direction** — problems in `crates/core` have cascading impact on all other crates. Prioritize the domain.
- **Independent phases** — each phase must be mergeable into `main` without breaking what exists.
- **Be specific** — crate names, files, functions, line numbers. No vagueness.
- **Clippy is law** — any pattern that `cargo clippy -- -D warnings` would reject is a valid issue.

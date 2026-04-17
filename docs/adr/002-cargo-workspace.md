# ADR-002: Cargo Workspace with Shared Crates

## Status

Accepted

## Context

The application has domain logic (entities, rules), persistence (filesystem), search (indexing), and sync (cloud). We need to decide how to organize the Rust code.

Alternatives:
- **Monolith in `src-tauri/`** — all Rust code inside the Tauri app
- **Cargo workspace** — separate crates per bounded context

## Decision

Use a **Cargo workspace** with 4 crates + the Tauri app:

```
crates/core     → pure domain (zero framework dependencies)
crates/storage  → filesystem, atomic writes, lock, trash
crates/search   → Tantivy, full-text indexing
crates/sync     → cloud sync (Google Drive, OneDrive, Dropbox)
src-tauri       → thin IPC layer (delegates to crates)
```

## Rationale

- **Testability:** `crates/core` can be tested without Tauri, without filesystem, without I/O
- **Clean Architecture:** dependencies point inward (`src-tauri → storage → core`)
- **Reuse:** crates can be used in a CLI, server, or mobile without changes
- **Incremental compilation:** changes in one crate do not recompile the others
- **Separation of concerns:** each crate has a clear responsibility (DDD bounded contexts)

## Consequences

- Shared workspace dependencies via `[workspace.dependencies]`
- TypeScript bindings generated via `ts-rs` from structs in the crates
- `src-tauri` is thin — parse args → call crate → serialize response
- Domain (`crates/core`) never imports frameworks, Tauri, serde_json, or filesystem

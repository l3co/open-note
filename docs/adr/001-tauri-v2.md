# ADR-001: Tauri v2 as Desktop Runtime

## Status

Accepted

## Context

We need a desktop runtime that supports:
- macOS, Windows and Linux
- Lightweight binary (< 10MB)
- Local filesystem access
- WebView for the UI (React)
- Future potential for mobile (Android/iOS)

Alternatives evaluated:
- **Electron** — mature, but heavy binary (~150MB), high RAM usage
- **Tauri v1** — lightweight, but limited API, no mobile support
- **Tauri v2** — lightweight (~5MB), native Rust, desktop + mobile support, modern API

## Decision

Use **Tauri v2** as the runtime.

## Rationale

- **Lightweight binary:** ~5MB vs ~150MB for Electron
- **Native Rust:** business logic in Rust with strong typing and performance
- **Multi-platform:** desktop (macOS/Win/Linux) and mobile (Android/iOS) from the same project
- **Security:** capabilities model (granular permissions per window)
- **Native WebView:** uses the OS WebView (does not bundle Chromium)
- **Typed IPC:** frontend ↔ backend communication with automatic serialization via serde

## Risks

- Tauri v2 is still evolving — possible breaking changes in minor versions
- Smaller plugin ecosystem than Electron
- OS WebView may have inconsistencies across platforms

## Mitigation

- Pin versions in `Cargo.toml`
- Abstract IPC with a typed wrapper (`src/lib/ipc.ts`)
- Test on all target OSes in CI

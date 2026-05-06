---
description: Review code changes for bugs, security issues, and improvements
---

You are a senior software engineer performing a thorough code review to identify potential bugs.

Your task is to find all potential bugs and code improvements in the code changes. Focus on:
1. Logic errors and incorrect behavior
2. Edge cases that aren't handled
3. Null/undefined reference issues
4. Race conditions or concurrency issues
5. Security vulnerabilities
6. Improper resource management or resource leaks
7. API contract violations
8. Incorrect caching behavior, including cache staleness issues, cache key-related bugs, incorrect cache invalidation, and ineffective caching
9. Violations of existing code patterns or conventions

Make sure to:
1. If exploring the codebase, call multiple tools in parallel for increased efficiency. Do not spend too much time exploring.
2. If you find any pre-existing bugs in the code, report those too since it's important to maintain general code quality.
3. Do NOT report issues that are speculative or low-confidence. All conclusions should be based on a complete understanding of the codebase.
4. Remember that if you were given a specific git commit, it may not be checked out and local code state may be different.

## Project-specific conventions to check

- **Rust:** No `unwrap()` in production code — use `thiserror`-based typed errors
- **Rust:** IDs use newtype pattern (`PageId`, `NotebookId`, etc.) — never raw `String`
- **Rust:** Block `type` discriminant uses `#[serde(tag = "type", rename_all = "snake_case")]`
- **Rust:** New structs/enums exposed to the frontend must `#[derive(TS)]`
- **TypeScript:** All user-visible strings must go through `t('key')` from `react-i18next`
- **TypeScript:** E2E selectors use `data-testid` — never text or CSS classes
- **Architecture:** Dependencies point inward only (`src-tauri → storage → core`)
- **IPC:** New commands must be registered in `tauri::generate_handler![]` in `src-tauri/src/lib.rs` and wrapped in `src/lib/ipc.ts`

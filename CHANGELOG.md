# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

- **Multi-workspace support** — open and manage up to 10 workspaces simultaneously
- `WorkspaceSwitcher` component in sidebar with workspace list, focus, close, and create actions
- Keyboard shortcuts for workspace navigation: `⌘⇧W` / `⌘⇧O` (open picker), `⌘⇧]` / `⌘⇧[` (next/prev workspace)
- `WorkspacePicker` modal mode when workspaces are already open (overlay instead of full-screen)
- `StatusBar` now shows focused workspace name and count when multiple workspaces are open
- Workspace transition animation (fade-in) in content area on workspace switch
- `search_all_workspaces` IPC command for cross-workspace search (merges results by score)
- `CrossWorkspaceResult` type with `workspace_id` and `workspace_name` fields
- `Drop` impl for `SearchEngine` — commits pending writes on workspace close
- **AppState schema v2** — adds `schema_version`, `active_workspaces`, `focused_workspace_id`
- Automatic data migration from AppState v1 → v2 on first launch after update
- Versioned backup before migration: `app_state.json.v1.backup`
- `WorkspaceContext` per open workspace — isolated `SearchEngine`, `SyncCoordinator`, navigation state
- `useMultiWorkspaceStore` Zustand store for multi-workspace state management
- `useWorkspaceList` and `useFocusedWorkspace` React hooks
- i18n strings for all new workspace UI (pt-BR and en)
- E2E tests for multi-workspace flows (`e2e/multi-workspace.spec.ts`)
- Migration documentation (`docs/multiple_workspace/MIGRATION.md`)
- User guide for multi-workspace (`docs/USER_GUIDE_MULTI_WORKSPACE.md`)

### Changed

- IPC commands now accept optional `workspace_id` parameter (backward-compatible — defaults to focused workspace)
- `useWorkspaceStore` and `useNavigationStore` refactored as facades over `useMultiWorkspaceStore`
- `StatusBar` shows workspace name instead of root path
- `load_app_state` runs migration pipeline automatically and persists migrated state

### Fixed

- `SearchEngine` isolation: each workspace has its own Tantivy index directory; data never leaks between workspaces
- Navigation store toggle bug: removed redundant `set()` calls that caused double state application

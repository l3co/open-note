# Multi-Workspace — User Guide

## How to open multiple workspaces

1. Click the workspace name in the sidebar (top)
2. Select **"Open another workspace..."** or **"Create workspace..."**
3. The new workspace opens alongside the current one — both are visible in the selector

Or use the shortcut `⌘⇧O` (macOS) / `Ctrl+Shift+O` (Windows/Linux) to open the workspace selector.

## How to switch between workspaces

- **Sidebar selector**: click the workspace name button (top of the sidebar) to open a popover with all open workspaces, then click the desired one.
- **Next workspace**: `⌘⇧]` (macOS) / `Ctrl+Shift+]` (Windows/Linux)
- **Previous workspace**: `⌘⇧[` (macOS) / `Ctrl+Shift+[` (Windows/Linux)

## Keyboard shortcuts

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Open workspace selector | `⌘⇧W` or `⌘⇧O` | `Ctrl+Shift+W` or `Ctrl+Shift+O` |
| Next workspace | `⌘⇧]` | `Ctrl+Shift+]` |
| Previous workspace | `⌘⇧[` | `Ctrl+Shift+[` |

## How to close a workspace

1. Open the selector by clicking the workspace name
2. Hover over the workspace you want to close
3. Click the **✕** icon that appears on the right
4. Confirm in the dialog

> The workspace is only removed from the current session. Your data remains on disk.

## Cross-workspace search

The normal search (`⌘F` / `Ctrl+F`) is limited to the focused workspace.  
To search across all open workspaces, use `searchAllWorkspaces` via the IPC API.

## Limits

- Maximum of **10 workspaces** open simultaneously
- Each workspace uses ~50–80 MB of RAM (Tantivy index + cache)
- The search index is isolated per workspace

## FAQ

**"Are my data shared between workspaces?"**  
No. Notebooks, sections, pages, trash, and search index are completely isolated.

**"Can I open the same workspace in two app instances?"**  
No. The app uses a file lock per workspace to prevent data corruption.

**"What happens if I close the app with multiple workspaces open?"**  
On the next launch, the app restores the last focused workspace. Others can be reopened manually via the selector.

**"How much memory do workspaces use?"**  
Approximately 50–80 MB per open workspace with ~100 indexed pages.

**"Can I sync different workspaces to different providers?"**  
Yes. Sync settings (Google Drive, OneDrive, Dropbox) are independent per workspace.

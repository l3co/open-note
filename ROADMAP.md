# Open Note — Roadmap

## Vision

Open Note is a local-first desktop note-taking app that puts your data on your filesystem, not on someone else's server. It combines the structured hierarchy of OneNote with the open format of plain files — rich text, handwriting, PDF annotation, and cloud sync, all without lock-in, accounts, or telemetry.

---

## What's Built

The application is feature-complete for everyday use:

**Core editing**
- Rich text editor (TipTap / ProseMirror) with headings, lists, tables, code blocks with syntax highlighting, checklists, callouts, embeds, and a slash command menu
- Markdown mode (CodeMirror 6) with live toggle and bidirectional conversion
- Ink overlay — freehand annotation layer on top of any content
- Ink blocks — dedicated drawing areas within pages
- PDF viewer with inline rendering and ink annotation

**Organization**
- Workspace → Notebook → Section → Page hierarchy
- Multi-workspace — open and switch between multiple workspaces simultaneously
- Full-text search (Tantivy) with accent folding and snippet highlighting
- Soft-delete trash with configurable retention

**Storage & sync**
- Pages stored as `.opn.json` — human-readable, no proprietary format
- Atomic writes — crash-safe at all times
- Cloud sync with Google Drive, OneDrive, and Dropbox (OAuth2, opt-in)
- Import from cloud with conflict detection

**Polish**
- Three-layer theme system (base × accent × chrome tint)
- English and Portuguese (PT-BR) with runtime switching
- Keyboard shortcuts for all major actions

---

## What's Next

These are the current priorities, roughly in order:

1. **Mobile** — Tauri v2 targets Android and iOS. The Rust crates are already platform-agnostic; the frontend needs a mobile-optimized layout.
2. **Templates** — Page and notebook templates with a built-in library and user-defined templates.
3. **Real-time collaboration** — CRDTs for local-network sync between devices without a cloud intermediary.
4. **Export** — PDF export, HTML export, and Markdown export for all page types including ink.
5. **Plugin API** — A stable extension point for custom block types and sidebar panels.

---

## Non-Goals

These are things Open Note will deliberately never do:

- **Mandatory cloud account** — sync is always opt-in
- **Telemetry or analytics** — zero tracking, ever
- **Proprietary file format** — data must remain accessible without the app
- **Subscription model** — if monetization is added, it will be a one-time purchase
- **Web/SaaS version** — this is a desktop-first, local-first application

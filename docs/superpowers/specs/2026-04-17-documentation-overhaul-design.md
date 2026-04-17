# Documentation Overhaul — Design Spec

**Date:** 2026-04-17
**Status:** Approved

---

## Goal

Reorganize and rewrite the project documentation so that it serves two audiences well — external contributors and the solo maintainer — without duplication, outdated content, or language inconsistencies.

## Decisions

- **Language:** English for all documentation
- **Audience:** Both external contributors and the maintainer (no separate sections)
- **Historical docs:** Delete; update surviving docs to describe where features are implemented
- **README style:** Rewritten from scratch — narrative, modern, less table-heavy

---

## File Map

### Delete

All of the following are historical implementation notes. The code is the primary documentation. These files will be permanently removed:

```
docs/FASE_01.md – FASE_10.md        (phase implementation notes)
docs/excalidraw_integration/         (feature merged)
docs/multiple_workspace/             (feature merged)
docs/pdf-canvas/                     (feature merged)
docs/retrofit_react/                 (migration complete)
docs/scientist_mode/                 (internal draft)
docs/home_page_improvements/         (internal draft)
docs/note_templates/                 (internal draft)
docs/password_protected_notes/       (internal draft)
docs/redesign_plataforma/            (internal draft)
docs/OAUTH_SETUP.md                  (content absorbed into DEVELOPMENT.md)
```

### Keep and update

```
README.md                  ← full rewrite (see below)
CONTRIBUTING.md            ← translate to English, trim redundancies, add "Good first issues" note
ROADMAP.md                 ← translate to English, update React 18→19, reframe as product vision
docs/README.md             ← rewrite as English index
docs/ARCHITECTURE.md       ← review, keep if diagrams are current
docs/DATA_MODEL.md         ← verify reflects current block types and schema
docs/DEVELOPMENT.md        ← absorb OAUTH_SETUP.md content, translate any remaining Portuguese
docs/SYSTEM_DESIGN.md      ← remove "stubs" references to cloud sync
docs/IPC_REFERENCE.md      ← verify all commands are listed (currently claims 46)
docs/TESTING.md            ← translate any remaining Portuguese
docs/BUILD_AND_DEPLOY.md   ← translate any remaining Portuguese
docs/TROUBLESHOOTING.md    ← translate any remaining Portuguese
docs/GLOSSARY.md           ← translate any remaining Portuguese
docs/adr/                  ← keep all 9 ADRs, no changes needed
docs/superpowers/          ← keep as-is (internal dev infrastructure)
```

---

## README.md Structure

The new README follows the style of well-maintained open source projects (Zed, Helix, Lapce). No 15-row script tables. Narrative prose where it adds clarity.

```
# Open Note
<one-line tagline> + CI badge

<Two-sentence paragraph: what it is and why it exists>

## Getting Started
Prerequisites (5 items max, bullet list)
Three commands: clone, npm install, cargo tauri dev

## Features
Short grouped bullets (Rich Text, Ink & PDF, Search, Cloud Sync, Themes, i18n)
No tables. No marketing language.

## Architecture
Three-line ASCII dependency diagram
One paragraph per crate (core, storage, search, sync)

## Keyboard Shortcuts
Compact table (10 rows max)

## Documentation
Flat list of docs/ links, one line of context each

## License
MIT
```

**What moves out of README:**
- Full scripts table → `docs/DEVELOPMENT.md`
- Full project structure tree → `docs/ARCHITECTURE.md`
- Domain model detail → `docs/DATA_MODEL.md`

---

## CONTRIBUTING.md Structure

Translated to English. Trimmed to essentials:

```
# Contributing
Short intro paragraph

## Prerequisites
3 items (Rust, Node, Tauri CLI)

## Workflow
Branch naming, commit convention (Conventional Commits), PR checklist

## Good First Issues
Link to GitHub issues filtered by label

## Before a Large PR
Note to open an issue first
```

---

## ROADMAP.md Structure

Translated to English. Reframed from "phase plan" to "product vision":

```
# Roadmap

## Vision
What the product is and why it exists

## What's Built
Current feature set (accurate, matches README)
Correct: React 19, cloud sync working

## What's Next
Upcoming priorities (not time-boxed)

## Non-Goals
What this project will never do (telemetry, cloud-only, proprietary format)
```

---

## docs/README.md Structure

Central index, English, same flat structure as now but rewritten:

```
# Documentation

<One-line intro>

## Design & Architecture
Links with one-line descriptions

## API Reference
IPC_REFERENCE.md

## Development
DEVELOPMENT.md, TESTING.md, BUILD_AND_DEPLOY.md, TROUBLESHOOTING.md, CONTRIBUTING.md

## Decisions
ADRs table

## Quick Reference
"I need to..." table pointing to specific doc sections
```

---

## Content Updates Required

| File | Change |
|---|---|
| `docs/SYSTEM_DESIGN.md` | Remove "stubs" and "OAuth not yet configured" from cloud sync section |
| `docs/DEVELOPMENT.md` | Absorb OAuth setup content (provider credentials, env vars); verify IPC command count |
| `docs/DATA_MODEL.md` | Verify block types list matches `crates/core/src/block.rs`; update if needed |
| `docs/IPC_REFERENCE.md` | Verify all commands are present; add any missing from recent development |

---

## Out of Scope

- Translating ADR content (they are architectural records, language doesn't matter)
- Adding a documentation site (VitePress, Docusaurus) — not needed at this stage
- Changing `.windsurf/` — IDE config, not documentation
- Writing new technical content beyond what already exists

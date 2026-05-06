---
description: Feature planning — uses the brainstorming skill to design and document a new feature
---

Activated by the `/planejamento` command. Analyzes the current session context and starts the feature design process using the brainstorming skill, which produces a spec in `docs/superpowers/specs/` and a plan in `docs/superpowers/plans/`.

## Steps

### 1. Extract information from the conversation

Read the current conversation context and identify:

- **Feature name** — the main topic discussed (e.g. "macOS code signing", "template support", "offline sync")
- **Description** — 1–2 sentence summary of what the feature does
- **Problem/motivation** — why this feature is needed
- **Scope** — what is in and out of scope
- **Affected layers** — which crates, stores, components, IPC commands will be touched

---

### 2. Invoke the brainstorming skill

Use the `superpowers:brainstorming` skill to design the feature. The skill will:

1. Explore the project context relevant to the feature
2. Ask clarifying questions one at a time
3. Propose 2–3 implementation approaches with trade-offs
4. Present the design section by section for approval
5. Write the spec to `docs/superpowers/specs/YYYY-MM-DD-<feature>-design.md`
6. Transition to the `superpowers:writing-plans` skill to generate the implementation plan in `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`

---

### 3. Project-specific context to keep in mind

When brainstorming features for Open Note, always consider:

**Domain hierarchy:** `Workspace → Notebook → Section → Page → Block[]`

**Adding an IPC command requires:**
1. Logic in the appropriate crate (`core` for domain, `storage` for filesystem)
2. Handler in `src-tauri/src/commands/<module>.rs` with `#[tauri::command]`
3. Registration in `src-tauri/src/lib.rs` inside `tauri::generate_handler![]`
4. Typed wrapper in `src/lib/ipc.ts`
5. If return type is new: `#[derive(TS)]` and regenerate bindings with `cargo test -p opennote-core`

**Adding a block type requires:**
1. Struct in `crates/core/src/block.rs` + variant in `Block` enum
2. Update `crates/search/src/extract.rs` for text extraction
3. Update `src/lib/serialization.ts` (`blocksToTiptap` + `tiptapToBlocks`)
4. Serialization roundtrip test + search extraction test

**Architecture rules:**
- Dependencies point inward only: `src-tauri → storage → core`
- `crates/core` never imports Tauri, serde_json, or filesystem
- No `unwrap()` in production code
- All visible strings go through `t('key')` from `react-i18next`
- E2E selectors use `data-testid` only

**Documentation to update after implementation:**
- New IPC command → `docs/IPC_REFERENCE.md`
- New entity/block → `docs/DATA_MODEL.md`
- Architecture change → `docs/ARCHITECTURE.md`, `docs/SYSTEM_DESIGN.md`
- New architectural decision → `docs/adr/` (create ADR)

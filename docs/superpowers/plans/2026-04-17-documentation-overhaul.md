# Documentation Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize and rewrite all project documentation in English, delete historical phase/feature docs, and produce a clean modern README.

**Architecture:** Pure documentation work — no code changes. Each task touches one file or one logical group. Frequent commits keep history clean.

**Tech Stack:** Markdown, git

---

### Task 1: Delete historical docs

**Files:**
- Delete: `docs/FASE_01.md` – `docs/FASE_10.md`
- Delete: `docs/excalidraw_integration/`
- Delete: `docs/multiple_workspace/`
- Delete: `docs/pdf-canvas/`
- Delete: `docs/retrofit_react/`
- Delete: `docs/scientist_mode/`
- Delete: `docs/home_page_improvements/`
- Delete: `docs/note_templates/`
- Delete: `docs/password_protected_notes/`
- Delete: `docs/redesign_plataforma/`
- Delete: `docs/OAUTH_SETUP.md` (content absorbed into DEVELOPMENT.md in Task 6)

- [ ] Run:
```bash
git rm -r \
  docs/FASE_01.md docs/FASE_02.md docs/FASE_03.md docs/FASE_04.md docs/FASE_05.md \
  docs/FASE_06.md docs/FASE_07.md docs/FASE_08.md docs/FASE_09.md docs/FASE_10.md \
  docs/excalidraw_integration/ docs/multiple_workspace/ docs/pdf-canvas/ \
  docs/retrofit_react/ docs/scientist_mode/ docs/home_page_improvements/ \
  docs/note_templates/ docs/password_protected_notes/ docs/redesign_plataforma/ \
  docs/OAUTH_SETUP.md
```

- [ ] Commit:
```bash
git commit -m "docs: delete historical phase docs and internal feature drafts"
```

---

### Task 2: Rewrite README.md

**Files:**
- Modify: `README.md`

New content: modern open-source style. Narrative prose, no scripts table, no long project tree.

- [ ] Write new `README.md` (full rewrite)
- [ ] Verify: `npm run build` still works (README doesn't affect build, but sanity check)
- [ ] Commit:
```bash
git add README.md
git commit -m "docs: rewrite README with modern style (English, narrative, concise)"
```

---

### Task 3: Rewrite CONTRIBUTING.md

**Files:**
- Modify: `CONTRIBUTING.md`

Translate to English. Keep: branch naming, commit convention, PR checklist. Add: "Good First Issues" note, "Open an issue before a large PR" note.

- [ ] Write new `CONTRIBUTING.md`
- [ ] Commit:
```bash
git add CONTRIBUTING.md
git commit -m "docs: rewrite CONTRIBUTING in English, add good-first-issues note"
```

---

### Task 4: Rewrite ROADMAP.md

**Files:**
- Modify: `ROADMAP.md`

Translate to English. Reframe from phase plan to product vision. Fix React 18 → React 19. Sections: Vision → What's Built → What's Next → Non-Goals.

- [ ] Write new `ROADMAP.md`
- [ ] Commit:
```bash
git add ROADMAP.md
git commit -m "docs: rewrite ROADMAP in English as product vision (not phase plan)"
```

---

### Task 5: Rewrite docs/README.md (index)

**Files:**
- Modify: `docs/README.md`

Translate to English. Remove links to deleted docs. Keep flat structure with one-line descriptions. Update quick-reference table.

- [ ] Write new `docs/README.md`
- [ ] Commit:
```bash
git add docs/README.md
git commit -m "docs: rewrite docs/README index in English, remove deleted doc links"
```

---

### Task 6: Update DEVELOPMENT.md

**Files:**
- Modify: `docs/DEVELOPMENT.md`

Translate Portuguese → English. Add OAuth credentials section (content from deleted OAUTH_SETUP.md). Verify IPC command count.

- [ ] Translate and update `docs/DEVELOPMENT.md`
- [ ] Add OAuth setup section at the end
- [ ] Commit:
```bash
git add docs/DEVELOPMENT.md
git commit -m "docs: translate DEVELOPMENT.md to English, absorb OAUTH_SETUP content"
```

---

### Task 7: Update SYSTEM_DESIGN.md

**Files:**
- Modify: `docs/SYSTEM_DESIGN.md`

Translate Portuguese → English. Remove "stubs" and "OAuth not yet configured" from cloud sync section. Update any stale React version references.

- [ ] Translate and update `docs/SYSTEM_DESIGN.md`
- [ ] Commit:
```bash
git add docs/SYSTEM_DESIGN.md
git commit -m "docs: translate SYSTEM_DESIGN.md to English, fix stale cloud sync refs"
```

---

### Task 8: Translate remaining docs

**Files:**
- Modify: `docs/TESTING.md`
- Modify: `docs/BUILD_AND_DEPLOY.md`
- Modify: `docs/TROUBLESHOOTING.md`
- Modify: `docs/GLOSSARY.md`

Translate Portuguese → English. No structural changes needed.

- [ ] Translate `docs/TESTING.md`
- [ ] Translate `docs/BUILD_AND_DEPLOY.md`
- [ ] Translate `docs/TROUBLESHOOTING.md`
- [ ] Translate `docs/GLOSSARY.md`
- [ ] Commit:
```bash
git add docs/TESTING.md docs/BUILD_AND_DEPLOY.md docs/TROUBLESHOOTING.md docs/GLOSSARY.md
git commit -m "docs: translate TESTING, BUILD_AND_DEPLOY, TROUBLESHOOTING, GLOSSARY to English"
```

---

### Task 9: Verify IPC_REFERENCE.md and DATA_MODEL.md

**Files:**
- Modify: `docs/IPC_REFERENCE.md`
- Modify: `docs/DATA_MODEL.md`

Spot-check IPC commands against `src-tauri/src/lib.rs`. Spot-check block types against `crates/core/src/block.rs`. Translate any Portuguese headers/descriptions found.

- [ ] Check command count: `grep -c "tauri::command" src-tauri/src/commands/*.rs | tail -1`
- [ ] Check block types: `grep "enum Block" crates/core/src/block.rs -A 30`
- [ ] Translate/fix `docs/IPC_REFERENCE.md` if needed
- [ ] Translate/fix `docs/DATA_MODEL.md` if needed
- [ ] Commit:
```bash
git add docs/IPC_REFERENCE.md docs/DATA_MODEL.md
git commit -m "docs: verify and translate IPC_REFERENCE and DATA_MODEL to English"
```

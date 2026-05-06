---
description: Refactor React — analyzes the entire frontend and generates a refactoring plan in docs/
---

Activated by the `/refactor-react` command. Analyzes the project's entire React/TypeScript code as a performance and best practices expert, and generates structured refactoring planning documentation — **without implementing any code changes**.

## Focus areas (ordered by impact)

- **CRITICAL** — Data waterfalls (sequential IPC calls that could be parallel), excessive bundle size
- **HIGH** — Unnecessary re-renders (missing `memo`, `useCallback`, `useMemo`)
- **MEDIUM** — Derived state computed in render, unstable callbacks causing cascade re-renders, Zustand store over-subscriptions
- **LOW** — Pure functions that could be module-level cached, RegExp created inside loops, event listeners not cleaned up

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
ls /Users/leco/RustroverProjects/open-note/docs/ | grep refactor-react
```

If `refactor-react-{DATE}` already exists, add a `-v2` suffix.

---

### 3. Create the output directory

```bash
mkdir -p /Users/leco/RustroverProjects/open-note/docs/refactor-react-{DATE}
```

---

### 4. Scan the full frontend

Read and analyze **all** relevant frontend files as an expert. Do not skip files.

#### 4.1 — Components

```bash
find /Users/leco/RustroverProjects/open-note/src/components -name "*.tsx" -o -name "*.ts" | sort
```

For each component, evaluate:
- Data waterfalls (sequential IPC calls that could be parallel)
- Unnecessary re-renders (missing `memo`, `useCallback`, `useMemo`)
- Derived state computed in render
- Static JSX inside components (should be hoisted)
- Barrel imports that inflate the bundle

#### 4.2 — Zustand Stores

```bash
find /Users/leco/RustroverProjects/open-note/src -name "*.ts" -path "*/stores/*" | sort
```

Evaluate:
- Unnecessary subscriptions to the entire store when only one field is used
- Derived state calculated in render vs. optimized selectors
- Unstable callbacks causing cascade re-renders

#### 4.3 — Custom Hooks

```bash
find /Users/leco/RustroverProjects/open-note/src/hooks -name "*.ts" -o -name "*.tsx" | sort
```

Evaluate:
- Effect dependencies with objects/arrays (should use primitives)
- Duplicate or uncleaned event listeners
- Missing lazy initialization for expensive calculations

#### 4.4 — Library and utilities

```bash
find /Users/leco/RustroverProjects/open-note/src/lib -name "*.ts" | sort
```

Evaluate:
- Pure functions that could be cached at module level
- Repeated array lookups that could use `Map` or `Set`
- RegExp created inside loops

#### 4.5 — General metrics

```bash
find /Users/leco/RustroverProjects/open-note/src -name "*.tsx" -o -name "*.ts" | grep -v "__tests__" | grep -v ".d.ts" | wc -l
```

```bash
cat /Users/leco/RustroverProjects/open-note/package.json
```

---

### 5. Generate `roadmap.md`

Create `docs/refactor-react-{DATE}/roadmap.md` with:
- Overall diagnosis of the frontend state and what the refactoring aims to improve
- Issues found per category (waterfalls, bundle size, re-renders, rendering, JS perf) with severity and impact
- Files with the highest concentration of issues
- Complexity assessment (score X/10 with justification)
- Phased refactoring strategy prioritized by impact
- Acceptance criteria (Definition of Done)

---

### 6. Generate `fase_1.md` (and additional phases)

Create `docs/refactor-react-{DATE}/fase_01.md` covering the **highest severity** issues (waterfalls and bundle size), and additional phase files for lower severity issues (re-renders, JS performance).

Each phase file must include:
- Objective with measurable expected impact (e.g. -X ms TTI, -X KB bundle)
- Current context with **real code snippets** — never invent code
- Specific tasks with current code (problem) + proposed solution (fix)
- Files modified / not modified in this phase
- Phase acceptance criteria

---

### 7. Verify generated files

```bash
ls -la /Users/leco/RustroverProjects/open-note/docs/refactor-react-{DATE}/
```

---

### 8. Summarize the diagnosis

Present to the user:
- The directory created in `docs/`
- Total number of issues per category
- The 3–5 most critical issues with exact location
- List of phases with effort and priority
- Total effort estimate
- Ask if there are scope or phase prioritization adjustments

---

## Important Notes

- **NEVER implement code** — this workflow only generates planning.
- **Use real code** — when describing problems, include real snippets from files actually read. Never invent generic examples.
- **Prioritize by impact** — waterfalls > bundle > re-renders > rendering > JS perf > advanced patterns.
- **Independent phases** — each phase must be mergeable into `main` without breaking what exists.
- **Be specific** — file names, line numbers, function/component names. No vagueness.

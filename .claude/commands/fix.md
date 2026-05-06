---
description: Error fixing workflow — diagnose, fix, validate, and commit
---

Complete workflow for fixing errors in Open Note. Identifies the root cause, fixes it, validates quality, and commits.

## Steps

### Phase 1 — Diagnosis

1. **Identify the error** — Read the full error message (stack trace, file, line). Classify the type:
   - Rust compilation error → clippy / cargo build
   - TypeScript type error → typecheck
   - Rust test failure → cargo test
   - Vitest test failure → npm run test
   - Playwright E2E test failure → npx playwright test
   - Lint/format error → eslint / prettier / rustfmt
   - Runtime error → application logs / browser console

2. **Reproduce the error locally** — Run the command corresponding to the error type to confirm you can reproduce it before fixing.
```bash
git status
```

3. **Analyze the root cause** — Read the files involved in the error. Identify the root cause, not just the symptom. Questions to answer:
   - Which file and line caused the error?
   - Was the change that introduced the error intentional?
   - Is the error in new code or in outdated tests?
   - Is there a dependency between modules that explains the error?

### Phase 2 — Fix

4. **Fix the root cause** — Apply the minimum necessary fix. Prefer:
   - Upstream fix (in the code that causes the problem) rather than a downstream workaround
   - Single-line change when sufficient — don't over-engineer
   - Maintain the existing code style

5. **Verify the fix resolves the error** — Run the specific command that reproduced the error:
   - Rust: `cargo build --workspace` or `cargo test --workspace`
   - Frontend: `npm run typecheck` or `npm run test`
   - E2E: `npx playwright test <specific-file>`

### Phase 3 — Full Validation (same as commit workflow)

6. **Format Rust code**
```bash
cargo fmt --all
```

7. **Lint Rust (Clippy)**
```bash
cargo clippy --workspace -- -D warnings
```

8. **Run Rust tests**
```bash
cargo test --workspace
```

9. **Check TypeScript bindings**
```bash
git diff --name-only src/types/bindings/
```
If there are modified files, include them in the commit.

10. **Lint Frontend (ESLint)**
```bash
npm run lint
```

11. **Format Frontend (Prettier)**
```bash
npm run format
```

12. **TypeScript check**
```bash
npm run typecheck
```

13. **Run Frontend tests**
```bash
npm run test
```

### Phase 4 — Commit

14. **Review final diff**
```bash
git diff --stat
```

15. **Stage files**
```bash
git add <files>
```

16. **Commit with Conventional Commits** — Use `fix:` for bug fixes:
```bash
git commit -m "fix: <short description of the fix>

<explanation of root cause and what was fixed>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

## Notes

- **Never apply a workaround** without understanding the root cause.
- If full validation (steps 6–13) reveals **new errors** introduced by the fix, go back to step 4.
- If the error is in an **outdated test** (not in production code), fix the test — but first verify whether the code behavior really changed intentionally.
- Fix commits should be **atomic** — one bug per commit.
- Never commit with failing tests or clippy warnings.

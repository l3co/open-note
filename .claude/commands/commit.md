---
description: Pre-commit workflow — lint, format, test, and commit with Conventional Commits
---

Complete workflow to prepare and execute a commit in Open Note. Ensures code quality before committing.

## Steps

1. **Check modified files** — Identify what changed to contextualize the commit.
```bash
git status
```

2. **Format Rust code** — Apply `rustfmt` to all crates.
```bash
cargo fmt --all
```

3. **Lint Rust (Clippy)** — Check for warnings and errors in the backend.
```bash
cargo clippy --workspace -- -D warnings
```

4. **Run Rust tests** — Execute all workspace tests (also regenerates TypeScript bindings via ts-rs).
```bash
cargo test --workspace
```

5. **Check TypeScript bindings** — Confirm that the generated bindings in `src/types/bindings/` are up to date.
```bash
git diff --name-only src/types/bindings/
```
If there are modified files, include them in the commit.

6. **Lint Frontend (ESLint)** — Check lint rules in the TypeScript/React code.
```bash
npm run lint
```

7. **Format Frontend (Prettier)** — Apply automatic formatting.
```bash
npm run format
```

8. **TypeScript check** — Check for type errors.
```bash
npm run typecheck
```

9. **Run Frontend tests** — Execute unit tests with Vitest.
```bash
npm run test
```

10. **Update documentation** — If there were structural changes (new IPC command, new block type, new entity, architecture change), update the relevant docs:
    - New IPC command → `docs/IPC_REFERENCE.md`
    - New entity/block → `docs/DATA_MODEL.md`
    - Architecture change → `docs/ARCHITECTURE.md`, `docs/SYSTEM_DESIGN.md`
    - New decision → `docs/adr/` (create ADR)
    - New troubleshooting → `docs/TROUBLESHOOTING.md`
    - Update memory in `.claude/` if there is a significant project change

11. **Review final diff** — Review all changes that will be committed.
```bash
git diff --stat
```

12. **Stage files** — Add the files to staging. Prefer staging specific files rather than `git add -A` to avoid accidentally including sensitive files.
```bash
git add <files>
```

13. **Commit with Conventional Commits** — Create the commit following the convention:
    - `feat:` — New feature
    - `fix:` — Bug fix
    - `docs:` — Documentation
    - `refactor:` — Refactoring without behavior change
    - `test:` — Adding/changing tests
    - `chore:` — Maintenance, deps, CI
    - `style:` — Formatting (no logic change)
    - `perf:` — Performance improvement

```bash
git commit -m "<type>: <description>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

## Notes

- If any lint or test step **fails**, fix it before proceeding.
- Commits should be **small and atomic** — one responsibility per commit.
- If the commit includes multiple independent changes, consider splitting into separate commits.
- Never commit with failing tests or clippy warnings.

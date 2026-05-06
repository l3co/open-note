---
description: Full local validation — mirrors all CI steps (lint, typecheck, tests, E2E)
---

Runs all the checks that CI performs, in the same order and with the same criteria.
Useful for ensuring nothing will break on GitHub Actions before opening a PR.

## Steps

### Rust

1. **Check Rust formatting** — Equivalent to the `lint-rust` job (cargo fmt --check).
```bash
cargo fmt --check --all
```

2. **Clippy (Rust lint)** — Treats warnings as errors, same as CI.
```bash
cargo clippy --workspace -- -D warnings
```

3. **Rust tests** — Runs all workspace tests (also regenerates ts-rs bindings).
```bash
cargo test --workspace
```

4. **Check TypeScript bindings** — Confirms that `src/types/bindings/` is in sync with the Rust code.
```bash
git diff --exit-code src/types/bindings/
```
If there is a diff, commit the updated bindings before continuing.

---

### Frontend

5. **ESLint** — Lint the TypeScript/React code.
```bash
npm run lint
```

6. **Prettier check** — Check formatting without changing files.
```bash
npm run format:check
```

7. **TypeScript check** — Strict type checking.
```bash
npm run typecheck
```

8. **Unit tests with coverage** — Vitest, same as CI (`test:coverage`).
```bash
npm run test:coverage
```

---

### E2E

9. **Install Playwright browsers** — Required if not yet installed or after a version update.
```bash
npx playwright install --with-deps chromium
```

10. **Run E2E tests** — Full Playwright suite.
```bash
npx playwright test
```

---

## Notes

- **Failure at any step = stop and fix** before proceeding.
- Steps 1–4 mirror the `lint-rust` and `test-rust` CI jobs.
- Steps 5–8 mirror the `lint-frontend` and `test-frontend` CI jobs.
- Steps 9–10 mirror the `test-e2e` CI job.
- To view the E2E report after running: `npx playwright show-report`.
- To skip E2E (faster): run only steps 1–8.

# Troubleshooting — Open Note

Common problems encountered during development and use, with solutions.

---

## Development Environment

### Error: "failed to run custom build command for webkit2gtk-sys"

**Platform:** Linux

**Cause:** Missing system dependencies.

**Fix:**
```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev librsvg2-dev patchelf libssl-dev libgtk-3-dev libayatana-appindicator3-dev
```

---

### Error: `cargo build` fails with linking errors

**Platform:** macOS

**Cause:** Xcode Command Line Tools not installed.

**Fix:**
```bash
xcode-select --install
```

---

### Error: `npm ci` fails with wrong Node version

**Cause:** Node.js version differs from what's expected.

**Fix:**
```bash
nvm use              # Uses version from .nvmrc
node --version       # Should be 23.x
```

---

### Rust hot reload doesn't work (`tauri dev`)

**Cause:** Tauri CLI may not detect changes in nested crates.

**Fix:**
1. Save the modified file again
2. If it persists, restart `npm run tauri dev`
3. Verify that `src-tauri/Cargo.toml` lists the crate as a dependency

---

### TypeScript bindings are out of date

**Symptom:** Type error in the frontend after changing a Rust struct.

**Cause:** Bindings in `src/types/bindings/` were not regenerated.

**Fix:**
```bash
cargo test -p opennote-core    # Regenerates bindings
```

CI automatically verifies this via `git diff --exit-code src/types/bindings/`.

---

### ESLint or Prettier fails in CI but passes locally

**Cause:** Different Node version or dependency mismatch.

**Fix:**
```bash
rm -rf node_modules
npm ci                  # Installs exactly what's in the lock file
npm run lint
npm run format:check
```

---

## Runtime

### Error: "Workspace is locked by another process"

**Cause:** Another app instance is using the same workspace, or the app crashed without releasing the `.lock` file.

**Fix:**
1. Close all Open Note instances
2. If it persists: the `.lock` is stale — the app automatically detects and removes locks from processes that no longer exist
3. As a last resort, manually delete the `.lock` file in the workspace root

---

### Error: "WorkspaceNotFound"

**Cause:** The workspace directory was moved or deleted externally.

**Fix:**
1. The app opens the WorkspacePicker automatically
2. Remove the workspace from the recent list
3. Recreate it or point to the new path

---

### Search doesn't return expected results

**Cause:** Tantivy index is out of date or corrupted.

**Fix:**
1. Rebuild the index via Settings or programmatically:
```typescript
await ipc.rebuildIndex();
```
2. If it persists, delete `.opennote/index/` and reopen the workspace (it rebuilds automatically)

---

### Page not saving (status stuck on "saving")

**Possible causes:**
- Workspace root is undefined (workspace closed during save)
- `.opn.json` file has read-only permissions
- Disk full

**Fix:**
1. Check if the workspace is open (StatusBar shows the path)
2. Check permissions on the workspace directory
3. Check disk space
4. Restart the app (auto-save flushes on unmount)

---

### Theme not applying correctly

**Cause:** `data-theme` or `data-chrome` not updated in the DOM.

**Fix:**
1. Go to Settings → Appearance and reselect the theme
2. If the "System" theme doesn't follow the OS, check that `window.matchMedia('(prefers-color-scheme: dark)')` works in the browser
3. Restarting the app restores the theme from `app_state.json`

---

### Permission denied when opening a cloud-synced workspace

**Cause:** Files downloaded from cloud sync may have been created with a restrictive `umask`, leaving directories without execute permissions.

**Fix:** The app automatically repairs workspace permissions on open. If the problem persists, check the logs for `chmod` warnings and verify the workspace directory is owned by the current user.

---

## Tests

### Rust tests fail with "Permission denied"

**Cause:** Storage integration tests create temporary files.

**Fix:**
```bash
cargo clean
cargo test --workspace
```

---

### E2E tests fail with timeout

**Cause:** Dev server didn't start in time, or port 1420 is occupied.

**Fix:**
1. Check if port 1420 is free: `lsof -i :1420`
2. Kill the process if needed: `kill -9 <PID>`
3. Increase timeout in `playwright.config.ts` if needed
4. Run with debug: `npx playwright test --debug`

---

### E2E tests fail with "Tauri IPC not available"

**Cause:** IPC mock was not injected correctly.

**Fix:**
1. Verify `setupIpcMock(page)` is called before `page.goto()`
2. The mock must be injected via `page.addInitScript()` (before React loads)
3. Check `e2e/helpers/ipc-mock.ts` for the full mock

---

### Coverage below threshold

**Cause:** New code without sufficient tests.

**Fix:**
1. Check the report: `npm run test:coverage` (generates HTML in `coverage/`)
2. Add tests for uncovered lines and branches
3. Thresholds: lines 80%, branches 70% (configurable in `vitest.config.ts`)

---

## Build

### Tauri build fails with "resource not found"

**Cause:** Missing icons or assets.

**Fix:**
```bash
npx tauri icon src-tauri/icons/icon.png
```

---

### Production build is too large

**Cause:** Debug symbols included.

**Fix:** Verify the build uses `--release` (it does by default with `npm run tauri build`).

Check the release profile in `src-tauri/Cargo.toml`:
```toml
[profile.release]
strip = true
lto = true
```

---

## Related Documents

| Document | Content |
|---|---|
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Setup guide |
| [TESTING.md](./TESTING.md) | Test strategy |
| [BUILD_AND_DEPLOY.md](./BUILD_AND_DEPLOY.md) | Build and distribution |

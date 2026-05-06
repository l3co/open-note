# Build & Deploy — Open Note

Complete guide for building, releasing, and distributing Open Note.

---

## 1. Development Builds

**Frontend (Vite):**
```bash
npm run dev          # Dev server with HMR on port 1420
npm run build        # Production build (TypeScript check + Vite)
npm run preview      # Preview the production build
```

**Backend (Rust):**
```bash
cargo build --workspace              # Debug build
cargo build --workspace --release    # Release build (optimized)
```

**Full app (Tauri):**
```bash
npm run tauri dev      # Dev mode (frontend HMR + Rust hot reload)
npm run tauri build    # Production build (generates installer)
```

---

## 2. Production Builds

The production build generates a native installer for each platform:

| Platform | Target | Format |
|---|---|---|
| **macOS** (Apple Silicon) | `aarch64-apple-darwin` | `.dmg`, `.app` |
| **macOS** (Intel) | `x86_64-apple-darwin` | `.dmg`, `.app` |
| **macOS** (Universal) | `universal-apple-darwin` | `.dmg`, `.app` |
| **Linux** | `x86_64-unknown-linux-gnu` | `.deb`, `.AppImage`, `.rpm` |
| **Windows** | `x86_64-pc-windows-msvc` | `.msi`, `.exe` |

```bash
# Build for current platform
npm run tauri build

# Build for specific target
npm run tauri build -- --target aarch64-apple-darwin

# Build universal macOS binary
npm run tauri build -- --target universal-apple-darwin
```

Output artifacts:
```
src-tauri/target/release/bundle/
├── dmg/         # macOS
├── deb/         # Linux .deb
├── appimage/    # Linux AppImage
├── rpm/         # Linux RPM
└── msi/         # Windows
```

**Expected binary sizes** (Tauri is significantly smaller than Electron):
- **macOS:** ~8–12 MB (.app)
- **Linux:** ~10–15 MB (.AppImage)
- **Windows:** ~8–12 MB (.exe)

---

## 3. Tauri Configuration

File: `src-tauri/tauri.conf.json`

Key settings:
- **App identifier** — bundle identifier
- **Window** — title, dimensions, decorations
- **Security** — capabilities in `capabilities/default.json`
- **Icons** — generated for all platforms in `src-tauri/icons/`

**Capabilities (permissions):**

Tauri v2 uses granular capabilities. Only explicitly listed permissions are granted:

```json
// src-tauri/capabilities/default.json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "shell:default"
  ]
}
```

---

## 4. CI/CD Pipeline

### GitHub Actions

Defined in `.github/workflows/ci.yml` (push/PR) and `.github/workflows/release.yml` (manual release).

**CI flow:**
```
Push/PR → Lint → Test → Build (macOS + Linux + Windows)
```

**CI jobs:**

| Job | Runner | Dependencies | Duration |
|---|---|---|---|
| `lint-rust` | ubuntu-latest | — | ~2 min |
| `lint-frontend` | ubuntu-latest | — | ~1 min |
| `test-rust` | ubuntu-latest | lint-rust | ~3 min |
| `test-frontend` | ubuntu-latest | lint-frontend | ~2 min |
| `test-e2e` | ubuntu-latest | lint-frontend | ~3 min |
| `build` | macOS, Linux, Windows | all tests | ~10 min |

**Caching:**
- **Cargo:** `~/.cargo/registry`, `~/.cargo/git`, `target/` — key based on `Cargo.lock`
- **npm:** native `actions/setup-node` cache based on `package-lock.json`

**Automated checks:**

| Check | Command | Fails if |
|---|---|---|
| Rust formatting | `cargo fmt --check --all` | Code not formatted |
| Rust linting | `cargo clippy -- -D warnings` | Any warning |
| Rust tests | `cargo test --workspace` | Any test fails |
| TS bindings | `git diff --exit-code src/types/bindings/` | Bindings out of date |
| ESLint | `npm run lint` | Rule violation |
| Prettier | `npm run format:check` | Code not formatted |
| TypeScript | `npm run typecheck` | Type error |
| Frontend tests | `npm run test:coverage` | Test fails or coverage below threshold |
| E2E tests | `npx playwright test` | Test fails |

---

## 5. Release Flow

**Versioning:** Semantic Versioning (`MAJOR.MINOR.PATCH`):
- **MAJOR:** Breaking changes in the data format
- **MINOR:** New features (new block type, new IPC command)
- **PATCH:** Bug fixes, performance improvements

Version is defined in:
- `package.json` → `version`
- `src-tauri/Cargo.toml` → `version`
- `src-tauri/tauri.conf.json` → `version`

**Release process** (via `.github/workflows/release.yml`):

1. Merge all changes to `main`
2. Trigger the `Release` workflow manually on GitHub with a version tag (e.g., `v1.2.0`)
3. CI builds for macOS (universal), Linux (deb + AppImage + rpm), and Windows (msi + exe)
4. A draft GitHub Release is created with all artifacts attached
5. Review and publish the draft release

```bash
# The release workflow handles everything — just trigger it on GitHub Actions
# with the desired tag (e.g., v1.2.0)
```

---

## 6. Code Signing

**macOS:**

Requires Apple Developer ID Certificate for distribution outside the App Store:

```bash
# CI environment variables
APPLE_CERTIFICATE           # Base64-encoded .p12
APPLE_CERTIFICATE_PASSWORD  # Certificate password
APPLE_SIGNING_IDENTITY      # "Developer ID Application: Name (TEAM_ID)"
                            # Use "-" for ad-hoc signing in CI without a certificate
APPLE_API_KEY               # For notarization
APPLE_API_ISSUER            # Issuer ID
```

**Windows:**

Requires Authenticode certificate to avoid SmartScreen warnings:

```bash
WINDOWS_CERTIFICATE          # Base64-encoded .pfx
WINDOWS_CERTIFICATE_PASSWORD
```

**Linux:** No code signing required for distribution.

---

## 7. System Dependencies by Platform

**macOS:**
```bash
xcode-select --install
# Xcode Command Line Tools includes everything needed
```

**Ubuntu/Debian:**
```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  librsvg2-dev \
  patchelf \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev
```

**Fedora:**
```bash
dnf install -y \
  webkit2gtk4.1-devel openssl-devel gtk3-devel \
  librsvg2-devel patchelf libappindicator-gtk3-devel rpm-build
```

**Windows:** Visual Studio Build Tools 2022 (C++ workload) + WebView2 Runtime (included in Windows 11)

---

## Related Documents

| Document | Content |
|---|---|
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Development guide |
| [TESTING.md](./TESTING.md) | Test strategy |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common problems |

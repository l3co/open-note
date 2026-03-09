# Build & Deploy — Open Note

Guia completo de build, release, distribuição e CI/CD do Open Note.

---

## 1. Build de Desenvolvimento

### Frontend (Vite)

```bash
npm run dev          # Dev server com HMR na porta 1420
npm run build        # Build de produção (TypeScript check + Vite)
npm run preview      # Preview do build de produção
```

### Backend (Rust)

```bash
cargo build --workspace              # Debug build
cargo build --workspace --release    # Release build (otimizado)
```

### App completo (Tauri)

```bash
npm run tauri dev      # Dev mode (frontend HMR + Rust hot reload)
npm run tauri build    # Build de produção (gera instalador)
```

---

## 2. Build de Produção

O build de produção gera um instalador nativo para cada plataforma:

| Plataforma | Target | Formato |
|---|---|---|
| **macOS** (Apple Silicon) | `aarch64-apple-darwin` | `.dmg`, `.app` |
| **macOS** (Intel) | `x86_64-apple-darwin` | `.dmg`, `.app` |
| **Linux** | `x86_64-unknown-linux-gnu` | `.deb`, `.AppImage` |
| **Windows** | `x86_64-pc-windows-msvc` | `.msi`, `.exe` |

### Gerando o build

```bash
# Build para a plataforma atual
npm run tauri build

# Build para target específico
npm run tauri build -- --target aarch64-apple-darwin
```

Os artefatos são gerados em:
```
src-tauri/target/release/bundle/
├── dmg/         # macOS
├── deb/         # Linux .deb
├── appimage/    # Linux AppImage
└── msi/         # Windows
```

### Tamanho esperado

O binário Tauri é significativamente menor que Electron:
- **macOS:** ~8-12 MB (.app)
- **Linux:** ~10-15 MB (.AppImage)
- **Windows:** ~8-12 MB (.exe)

---

## 3. Configuração Tauri

Arquivo: `src-tauri/tauri.conf.json`

Configurações relevantes:
- **App identifier:** definido no conf
- **Window:** título, dimensões, decorações
- **Security:** capabilities em `capabilities/default.json`
- **Icons:** gerados para todas as plataformas em `src-tauri/icons/`

### Capabilities (Permissões)

O Tauri v2 usa um modelo de capabilities granulares:

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

Somente as permissões explicitamente listadas são concedidas à janela.

---

## 4. CI/CD Pipeline

### GitHub Actions

Definido em `.github/workflows/ci.yml`. Executado em push/PR para `main`.

#### Fluxo

```
Push/PR → Lint → Test → Build (multi-OS)
```

#### Jobs

| Job | Runner | Dependências | Duração |
|---|---|---|---|
| `lint-rust` | ubuntu-latest | — | ~2min |
| `lint-frontend` | ubuntu-latest | — | ~1min |
| `test-rust` | ubuntu-latest | lint-rust | ~3min |
| `test-frontend` | ubuntu-latest | lint-frontend | ~2min |
| `test-e2e` | ubuntu-latest | lint-frontend | ~3min |
| `build` | macOS, Linux, Windows | todos os testes | ~10min |

#### Caching

- **Cargo:** `~/.cargo/registry`, `~/.cargo/git`, `target/` — key baseada em `Cargo.lock`
- **npm:** cache nativo do `actions/setup-node` baseado em `package-lock.json`

### Verificações automáticas

| Verificação | Comando | Falha se |
|---|---|---|
| Rust formatting | `cargo fmt --check --all` | Código não formatado |
| Rust linting | `cargo clippy -- -D warnings` | Qualquer warning |
| Rust tests | `cargo test --workspace` | Teste falha |
| TS bindings | `git diff --exit-code src/types/bindings/` | Bindings desatualizados |
| ESLint | `npm run lint` | Violação de regra |
| Prettier | `npm run format:check` | Código não formatado |
| TypeScript | `npm run typecheck` | Erro de tipo |
| Frontend tests | `npm run test:coverage` | Teste falha ou coverage baixo |
| E2E tests | `npx playwright test` | Teste falha |

---

## 5. Release Flow

### Versionamento

Segue Semantic Versioning (`MAJOR.MINOR.PATCH`):

- **MAJOR:** Breaking changes no formato de dados
- **MINOR:** Novas features (novo block type, novo IPC command)
- **PATCH:** Bug fixes, melhorias de performance

Versão definida em:
- `package.json` → `version`
- `src-tauri/Cargo.toml` → `version`
- `src-tauri/tauri.conf.json` → `version`

### Processo de release

1. Atualizar versão nos 3 arquivos
2. Atualizar changelog (se existir)
3. Commit: `chore: bump version to X.Y.Z`
4. Tag: `git tag vX.Y.Z`
5. Push: `git push origin main --tags`
6. CI gera builds para as 3 plataformas
7. Criar GitHub Release com artefatos

### Futuramente: Auto-Update

O Tauri v2 suporta auto-update nativo. Quando habilitado:
1. App verifica endpoint de atualização no startup
2. Se nova versão disponível, baixa em background
3. Notifica o usuário
4. Instala na próxima reinicialização

Requer:
- Endpoint de update (GitHub Releases ou servidor custom)
- Code signing (macOS: Developer ID, Windows: Authenticode)

---

## 6. Code Signing

### macOS

Requer Apple Developer ID Certificate para distribuição fora da App Store:

```bash
# Variáveis de ambiente para CI
APPLE_CERTIFICATE          # Base64 do .p12
APPLE_CERTIFICATE_PASSWORD # Senha do certificado
APPLE_SIGNING_IDENTITY     # "Developer ID Application: Nome (TEAM_ID)"
APPLE_API_KEY             # Para notarização
APPLE_API_ISSUER          # Issuer ID
```

### Windows

Requer certificado Authenticode para evitar warning do SmartScreen:

```bash
WINDOWS_CERTIFICATE        # Base64 do .pfx
WINDOWS_CERTIFICATE_PASSWORD
```

### Linux

Não requer code signing para distribuição.

---

## 7. Landing Page

A landing page estática está em `site/`:

```
site/
├── assets/
│   ├── css/
│   └── images/
├── index.html
├── privacy.html
└── terms.html
```

### Deploy via GitHub Pages

Definido em `.github/workflows/gh-pages.yml`:
- Trigger: push na branch `main`
- Publica conteúdo de `site/` no GitHub Pages

---

## 8. Dependências de Sistema por Plataforma

### macOS

```bash
xcode-select --install
# Xcode Command Line Tools inclui tudo necessário
```

### Ubuntu/Debian

```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  librsvg2-dev \
  patchelf \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev
```

### Windows

- Visual Studio Build Tools 2022 (C++ workload)
- WebView2 Runtime (incluso no Windows 11)

---

## Documentos Relacionados

| Documento | Conteúdo |
|---|---|
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Guia de desenvolvimento |
| [TESTING.md](./TESTING.md) | Estratégia de testes |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Problemas comuns |

# Guia de Desenvolvimento — Open Note

Guia completo para configurar o ambiente, entender a estrutura e desenvolver no Open Note.

---

## 1. Pré-requisitos

| Ferramenta | Versão mínima | Verificação |
|---|---|---|
| **Rust** | 1.94+ (stable) | `rustc --version` |
| **Node.js** | 23.x (ver `.nvmrc`) | `node --version` |
| **npm** | 10.x | `npm --version` |
| **Tauri CLI** | 2.x | `npx tauri --version` |
| **Git** | 2.x | `git --version` |

### Dependências de sistema

**macOS:**
```bash
xcode-select --install
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev librsvg2-dev patchelf libssl-dev libgtk-3-dev libayatana-appindicator3-dev
```

**Windows:**
- Visual Studio Build Tools (C++ workload)
- WebView2 (incluso no Windows 11, instalar manualmente no Windows 10)

---

## 2. Setup Inicial

```bash
# 1. Clonar o repositório
git clone https://github.com/l3co/open-note.git
cd open-note

# 2. Instalar dependências Node.js
npm ci

# 3. Verificar toolchain Rust
rustup show

# 4. Build de verificação (Rust)
cargo build --workspace

# 5. Verificar que tudo funciona
cargo test --workspace
npm run test
npm run lint
npm run typecheck
```

---

## 3. Fluxo de Desenvolvimento Diário

### Modo dev (frontend + backend com hot reload)

```bash
# Terminal 1 — Abre o app Tauri com hot reload
npm run tauri dev
```

Isso inicia:
- **Vite** na porta 1420 (frontend com HMR)
- **Tauri** (backend Rust, recompila ao salvar)

### Apenas frontend (sem Rust)

```bash
npm run dev
```

Útil para trabalhar apenas na UI. IPC calls falharão sem o backend.

### Comandos úteis

| Comando | Descrição |
|---|---|
| `npm run dev` | Dev server Vite (porta 1420) |
| `npm run tauri dev` | App completo com hot reload |
| `npm run build` | Build de produção (frontend) |
| `npm run test` | Testes unitários frontend (Vitest) |
| `npm run test:watch` | Testes em modo watch |
| `npm run test:coverage` | Testes com relatório de coverage |
| `npm run test:e2e` | Testes E2E (Playwright) |
| `npm run test:rust` | Testes Rust (`cargo test --workspace`) |
| `npm run test:all` | Rust + frontend tests |
| `npm run lint` | ESLint no frontend |
| `npm run lint:rust` | `cargo fmt --check` + `cargo clippy` |
| `npm run lint:all` | Lint completo (Rust + frontend) |
| `npm run format` | Prettier (auto-fix) |
| `npm run format:check` | Prettier (check only) |
| `npm run typecheck` | TypeScript type check |

---

## 4. Estrutura do Projeto

```
open-note/
├── crates/                    # Rust — Cargo workspace
│   ├── core/                  # Domínio puro (entidades, regras, validações)
│   ├── storage/               # Filesystem (atomic writes, lock, trash, migrations)
│   ├── search/                # Tantivy (indexação, busca full-text)
│   └── sync/                  # Cloud sync (providers, manifest, conflicts)
├── src-tauri/                 # Tauri app (camada fina de IPC)
│   └── src/
│       ├── commands/          # 46 IPC handlers (delegam para crates)
│       ├── state.rs           # AppManagedState, SaveCoordinator
│       ├── lib.rs             # Registro de commands + setup
│       └── main.rs            # Entry point
├── src/                       # Frontend React + TypeScript
│   ├── components/            # Componentes React por domínio
│   │   ├── editor/            # TipTap, markdown, toolbar, slash menu
│   │   ├── ink/               # Canvas, ink overlay, ink block
│   │   ├── layout/            # Toolbar, Sidebar, ContentArea, StatusBar
│   │   ├── onboarding/        # Onboarding dialog
│   │   ├── pdf/               # PDF viewer
│   │   ├── search/            # QuickOpen, SearchPanel
│   │   ├── settings/          # Settings dialog (6 tabs)
│   │   ├── shared/            # CreateDialog, DeleteDialog, TrashPanel
│   │   ├── sidebar/           # NotebookTree, ContextMenu
│   │   ├── sync/              # SyncSettings
│   │   └── workspace/         # WorkspacePicker
│   ├── hooks/                 # Custom hooks (useAutoSave, useKeyboardShortcuts)
│   ├── lib/                   # Utilitários (ipc.ts, serialization.ts, theme.ts, i18n.ts)
│   ├── locales/               # Traduções (pt-BR.json, en.json)
│   ├── stores/                # Zustand stores (5 stores)
│   ├── styles/                # CSS global
│   └── types/                 # TypeScript types + bindings gerados
├── e2e/                       # Testes E2E (Playwright)
├── docs/                      # Documentação
├── site/                      # Landing page estática
└── global-assets/             # Logo, background
```

---

## 5. Convenções de Código

### Rust

- **Naming:** `snake_case` para funções/variáveis, `PascalCase` para tipos/traits
- **Erros:** `thiserror` para erros tipados, **nunca** `unwrap()` em produção
- **Serialização:** `serde` + `serde_json`, block types em `snake_case` via `#[serde(rename_all = "snake_case")]`
- **IDs:** Newtype pattern — `struct PageId(Uuid)`, nunca `String` raw
- **TypeScript bindings:** `#[derive(TS)]` em toda struct/enum exposta ao frontend
- **Funções:** ~10–20 linhas, uma responsabilidade, sem efeitos colaterais ocultos

### TypeScript / React

- **Naming:** `camelCase` para variáveis/funções, `PascalCase` para componentes/tipos
- **Componentes:** Functional components com hooks, sem class components
- **State:** Zustand stores separados por domínio
- **Styling:** TailwindCSS utility-first + CSS vars para temas
- **i18n:** Toda string visível via `t('key')`, nunca hardcoded
- **Imports:** Absolutos via alias `@/` para `src/`

### Commits

Conventional Commits:
- `feat:` — nova funcionalidade
- `fix:` — correção de bug
- `docs:` — documentação
- `refactor:` — refatoração sem mudança de comportamento
- `test:` — adição/alteração de testes
- `chore:` — manutenção, dependências, CI

---

## 6. Como Adicionar um Novo IPC Command

### 1. Definir no crate apropriado

Se envolve lógica de negócio, adicionar em `crates/core/`. Se envolve filesystem, em `crates/storage/`.

### 2. Criar o handler IPC

```rust
// src-tauri/src/commands/meu_modulo.rs
#[tauri::command]
pub fn meu_command(state: State<AppManagedState>, param: String) -> Result<MeuTipo, String> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::meu_metodo(&root, &param).map_err(|e| e.to_string())
}
```

### 3. Registrar em `lib.rs`

```rust
// src-tauri/src/lib.rs
.invoke_handler(tauri::generate_handler![
    // ... existentes
    meu_command,
])
```

### 4. Adicionar wrapper TypeScript

```typescript
// src/lib/ipc.ts
export const meuCommand = (param: string) =>
  invoke<MeuTipo>("meu_command", { param });
```

### 5. Gerar TypeScript bindings

Se o tipo de retorno é novo, adicionar `#[derive(TS)]` e rodar:

```bash
cargo test -p opennote-core  # Gera bindings em src/types/bindings/
```

---

## 7. Como Adicionar um Novo Tipo de Block

### 1. Definir struct no domínio

```rust
// crates/core/src/block.rs
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct MeuBlock {
    #[serde(flatten)]
    pub base: BlockBase,
    pub meu_campo: String,
}
```

### 2. Adicionar à enum Block

```rust
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Block {
    // ... existentes
    MeuBloco(MeuBlock),
}
```

### 3. Atualizar text extraction (search)

```rust
// crates/search/src/extract.rs
Block::MeuBloco(b) => {
    content.push_str(&b.meu_campo);
    content.push('\n');
}
```

### 4. Atualizar serialization (frontend)

```typescript
// src/lib/serialization.ts
// Adicionar case em blocksToTiptap() e tiptapToBlocks()
```

### 5. Criar componente React (se necessário)

### 6. Adicionar testes

- Unit test no domínio (serialização)
- Test de search extraction
- Test de serialization roundtrip

---

## 8. Como Adicionar uma Nova Tradução

### 1. Adicionar chave nos arquivos de locale

```json
// src/locales/pt-BR.json
{
  "meuComponente": {
    "titulo": "Meu Título",
    "descricao": "Descrição em português"
  }
}
```

```json
// src/locales/en.json
{
  "meuComponente": {
    "titulo": "My Title",
    "descricao": "Description in English"
  }
}
```

### 2. Usar no componente

```tsx
import { useTranslation } from 'react-i18next';

function MeuComponente() {
  const { t } = useTranslation();
  return <h1>{t('meuComponente.titulo')}</h1>;
}
```

---

## 9. Debugging

### Frontend

- **React DevTools** — inspecionar componentes e state
- **Vite HMR** — alterações refletem instantaneamente
- **Console** — `console.log` nos stores/components
- **Zustand DevTools** — via extensão do browser

### Backend (Rust)

- **Logs** — `log::info!()`, `log::debug!()`, `log::error!()`
- **Tauri console** — logs do Rust aparecem no terminal do `tauri dev`
- **Teste isolado** — `cargo test -p opennote-storage -- nome_do_teste`

### IPC

Para debugar comunicação frontend ↔ backend:
1. Adicionar `console.log` antes do `invoke()` no frontend
2. Adicionar `log::info!()` no handler Rust
3. Verificar serialização de argumentos (camelCase ↔ snake_case)

---

## 10. Editor Setup

### VS Code (recomendado)

Extensões sugeridas:
- **rust-analyzer** — Rust LSP
- **Tauri** — suporte a Tauri
- **ESLint** — linting TypeScript
- **Prettier** — formatação
- **Tailwind CSS IntelliSense** — autocomplete TailwindCSS

### Settings recomendadas

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer",
    "editor.formatOnSave": true
  },
  "rust-analyzer.check.command": "clippy"
}
```

---

## 11. Gestão de Dependências

### Rust

- Dependências compartilhadas definidas em `Cargo.toml` (workspace root)
- Cada crate tem seu próprio `Cargo.toml` com deps específicas
- Atualizar: `cargo update` (respeitando semver)

### Node.js

- Lock file: `package-lock.json` (commitado)
- Instalar: `npm ci` (determinístico)
- Adicionar: `npm install <pkg>`
- Node version: `.nvmrc` (`nvm use`)

### TypeScript Bindings

Gerados automaticamente por `ts-rs` quando testes Rust rodam:
```bash
cargo test -p opennote-core  # Regenera src/types/bindings/
```

CI verifica que bindings estão atualizados via `git diff --exit-code src/types/bindings/`.

---

## Documentos Relacionados

| Documento | Conteúdo |
|---|---|
| [TESTING.md](./TESTING.md) | Estratégia de testes detalhada |
| [BUILD_AND_DEPLOY.md](./BUILD_AND_DEPLOY.md) | Build, release, distribuição |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Guia de contribuição |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Problemas comuns e soluções |
| [IPC_REFERENCE.md](./IPC_REFERENCE.md) | Referência dos IPC commands |

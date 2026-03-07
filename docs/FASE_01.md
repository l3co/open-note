# Fase 01 — Fundação

## Objetivo

Criar a base técnica do projeto: scaffold Tauri v2 + React + TypeScript, estrutura de diretórios, tooling de desenvolvimento, CI/CD, e garantir que o ciclo de desenvolvimento (build, test, lint, run) funcione de ponta a ponta.

Nenhuma funcionalidade de negócio é implementada nesta fase. O foco é **infraestrutura de desenvolvimento**.

---

## Entregáveis

1. Projeto Tauri v2 inicializado com frontend React + TypeScript
2. Cargo workspace com crates compartilhados (`core`, `storage`, `search`, `sync`)
3. Estrutura de diretórios definida e documentada
4. Tooling configurado (ESLint, Prettier, Rustfmt, Clippy)
5. Testes unitários configurados (Vitest no frontend, cargo test no Rust)
6. CI pipeline funcional (GitHub Actions)
7. README.md atualizado com instruções de setup
8. Primeiro build funcional (janela abre com placeholder)

---

## Estrutura do Projeto

O projeto usa **Cargo workspace** para separar a lógica de domínio (crates Rust reutilizáveis) da camada Tauri. Isso permite:

- Testar domínio isoladamente (sem dependência de Tauri ou UI)
- Manter crates puros e leves — facilitando compilação mobile
- Tauri v2 já compila nativamente para **desktop** (macOS, Windows, Linux) **e mobile** (Android, iOS) a partir do mesmo projeto

```
open-note/
├── ROADMAP.md
├── README.md
├── Cargo.toml                        # Rust workspace (members = crates/* + src-tauri)
├── package.json                      # Scripts (test:all, lint:all, etc.)
├── .github/
│    └── workflows/
│         ├── ci.yml                  # Lint + Test + Coverage + Build
│         └── release.yml             # Build e release multi-OS (futuro)
├── docs/
│    ├── FASE_01.md ... FASE_10.md
│    └── adr/                         # Architecture Decision Records
│         └── 001-tauri-v2.md
│
│  ┌─── Crates compartilhados (domínio puro, sem dependência de Tauri) ───┐
│
├── crates/
│    ├── core/                        # Domínio: entidades, regras de negócio, validações
│    │    ├── Cargo.toml
│    │    └── src/
│    │         ├── lib.rs
│    │         ├── workspace.rs       # Workspace, Notebook, Section, Page
│    │         ├── block.rs           # Block enum, BlockBase, todos os tipos
│    │         ├── annotation.rs      # InkAnnotation, HighlightAnnotation
│    │         ├── tag.rs             # Tag management
│    │         ├── trash.rs           # TrashItem, TrashManifest
│    │         ├── settings.rs        # AppState, GlobalSettings, ThemeConfig
│    │         └── error.rs           # Domain errors
│    │
│    ├── storage/                     # Persistência: filesystem, atomic writes, lock
│    │    ├── Cargo.toml              # depends on: core
│    │    └── src/
│    │         ├── lib.rs
│    │         ├── engine.rs          # StorageEngine trait + FileSystemEngine impl
│    │         ├── atomic.rs          # Atomic write (tmp + rename + fsync)
│    │         ├── lock.rs            # Workspace lock (.lock file)
│    │         ├── slug.rs            # Slug generation
│    │         ├── trash.rs           # Trash operations
│    │         └── assets.rs          # Asset lifecycle (import, move, delete)
│    │
│    ├── search/                      # Indexação: Tantivy (Fase 08)
│    │    ├── Cargo.toml              # depends on: core
│    │    └── src/
│    │         └── lib.rs             # placeholder
│    │
│    └── sync/                        # Cloud sync (Fase 09)
│         ├── Cargo.toml              # depends on: core, storage
│         └── src/
│              └── lib.rs             # placeholder
│
│  ┌─── Tauri app (camada fina sobre os crates) ─────────────────────────┐
│
├── src-tauri/                        # Backend Tauri v2 (desktop + mobile)
│    ├── Cargo.toml                   # depends on: core, storage, search, sync
│    ├── tauri.conf.json
│    ├── capabilities/                # Tauri v2 capabilities (permissões)
│    ├── build.rs
│    ├── gen/                         # Auto-gerado por Tauri (Android/iOS projects)
│    │    ├── android/                # Projeto Android (gerado por `cargo tauri android init`)
│    │    └── apple/                  # Projeto iOS (gerado por `cargo tauri ios init`)
│    └── src/
│         ├── main.rs
│         ├── lib.rs
│         ├── commands/               # Handlers IPC (thin: parse args → call crate → serialize)
│         │    ├── mod.rs
│         │    ├── workspace.rs
│         │    ├── notebook.rs
│         │    ├── page.rs
│         │    └── settings.rs
│         └── state.rs                # Tauri managed state (SaveCoordinator, etc.)
│
│  ┌─── Frontend (compartilhado entre desktop e mobile via WebView) ─────┐
│
├── src/                              # Frontend React + TypeScript
│    ├── main.tsx
│    ├── App.tsx
│    ├── assets/                      # Ícones, fontes, imagens estáticas
│    ├── components/                  # Componentes UI reutilizáveis
│    │    └── ui/                     # shadcn/ui components
│    ├── features/                    # Feature modules (por domínio)
│    │    ├── navigation/             # Sidebar, breadcrumb, workspace picker
│    │    ├── editor/                 # TipTap editor
│    │    ├── ink/                    # Canvas handwriting
│    │    └── pdf/                    # PDF viewer
│    ├── hooks/                       # Custom React hooks
│    ├── lib/                         # Utilitários, helpers
│    │    └── tauri.ts                # Wrapper tipado sobre invoke()
│    ├── stores/                      # Zustand stores
│    ├── types/                       # TypeScript types (gerados por ts-rs + manuais)
│    │    └── bindings/               # Auto-generated by ts-rs (do not edit)
│    └── styles/                      # Tailwind config, global CSS, temas
│
├── e2e/                              # Testes E2E (Playwright)
│    └── flows/
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── .eslintrc.cjs
├── .prettierrc
└── .gitignore
```

### Princípios da Estrutura

**Regra de ouro:** Toda lógica de negócio vive em `crates/`. `src-tauri/` é uma **camada fina** de IPC.

| Camada | Responsabilidade | Depende de |
|---|---|---|
| `crates/core` | Entidades, validações, regras de domínio | Nada (zero deps externas pesadas) |
| `crates/storage` | Filesystem, atomic writes, lock, trash, assets | `core` |
| `crates/search` | Indexação Tantivy | `core` |
| `crates/sync` | Cloud sync engine | `core`, `storage` |
| `src-tauri/` | Comandos IPC, managed state, config Tauri | Todos os crates |
| `src/` | UI React, stores, componentes | TypeScript types (ts-rs) |

**Cargo workspace** (`Cargo.toml` na raiz):

```toml
[workspace]
resolver = "2"
members = [
  "crates/core",
  "crates/storage",
  "crates/search",
  "crates/sync",
  "src-tauri",
]

[workspace.dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
thiserror = "1"
ts-rs = { version = "9", features = ["serde-compat"] }
```

### Multi-platform via Tauri v2

Tauri v2 compila nativamente para desktop e mobile a partir do **mesmo projeto**:

| Plataforma | Comando | Output |
|---|---|---|
| macOS | `cargo tauri build --target universal-apple-darwin` | `.dmg` |
| Windows | `cargo tauri build --target x86_64-pc-windows-msvc` | `.msi` |
| Linux | `cargo tauri build --target x86_64-unknown-linux-gnu` | `.deb`, `.AppImage` |
| Android | `cargo tauri android build` | `.apk` / `.aab` |
| iOS | `cargo tauri ios build` | `.ipa` |

**Escopo v1:** Desktop (macOS, Windows, Linux). Mobile (Android, iOS) planejado para versão futura — a estrutura já o suporta nativamente.

**Mobile — considerações futuras:**
- `src-tauri/gen/android/` e `src-tauri/gen/apple/` são gerados por `cargo tauri android init` / `cargo tauri ios init`
- O frontend React roda no WebView mobile (mesmo código, layout responsivo)
- Crates Rust compilam cross-platform — mesma lógica no desktop e mobile
- Adaptações de UI para touch/mobile ficam no frontend (media queries, gestos)
- Ink: Canvas API funciona em mobile com touch events nativamente

---

## Tarefas Detalhadas

### 1.1 — Inicializar projeto Tauri v2

**Ação:** Usar `create-tauri-app` com template React + TypeScript + Vite.

**Configurações Tauri (`tauri.conf.json`):**
- `productName`: "Open Note"
- `identifier`: "com.opennote.app"
- `windows[0].title`: "Open Note"
- `windows[0].width`: 1280
- `windows[0].height`: 800
- `windows[0].minWidth`: 800
- `windows[0].minHeight`: 600
- `security.csp`: configurar para permitir assets locais

**Critério de aceite:**
- `cargo tauri dev` abre janela com app React renderizado
- Hot reload funciona no frontend
- Rebuild automático do Rust ao alterar arquivos `.rs`

---

### 1.2 — Configurar Frontend (React + TypeScript)

**Dependências principais:**
- `react` + `react-dom` (v18+)
- `typescript` (v5+)
- `@tauri-apps/api` (v2)
- `tailwindcss` (v3+)
- `@radix-ui/react-*` (base para shadcn/ui)
- `zustand` (state management)
- `lucide-react` (ícones)

**Dependências de dev:**
- `vite`
- `@vitejs/plugin-react`
- `vitest` + `@testing-library/react`
- `eslint` + plugins (react, typescript, import)
- `prettier` + `prettier-plugin-tailwindcss`

**Critério de aceite:**
- `npm run dev` inicia o Vite dev server
- `npm run build` gera build de produção sem erros
- `npm run test` executa Vitest com pelo menos 1 teste passando
- `npm run lint` executa ESLint sem erros
- `npm run format` formata código com Prettier

---

### 1.3 — Configurar Backend Rust (Cargo Workspace)

**Dependências compartilhadas** (definidas em `[workspace.dependencies]` na raiz):
- `serde` + `serde_json` (serialização)
- `uuid` (geração de IDs)
- `chrono` (timestamps)
- `thiserror` (error handling)
- `ts-rs` (geração de TypeScript types)

**Dependências por crate:**
- `crates/core` → workspace deps apenas (domínio puro)
- `crates/storage` → `core` + `tempfile` (testes)
- `src-tauri` → `tauri` (v2) + todos os crates + `tokio`

**Configuração de qualidade:**
- `rustfmt.toml` na raiz (compartilhado)
- `clippy` no CI com `--workspace -- -D warnings`
- `cargo-tarpaulin` para coverage report

**Critério de aceite:**
- `cargo build --workspace` compila sem warnings
- `cargo test --workspace` executa com pelo menos 1 teste por crate
- `cargo clippy --workspace` passa sem warnings
- Crates criados com estrutura de módulos (mesmo que vazia com `todo!()`)
- Dependências entre crates compilam corretamente

---

### 1.4 — Primeiro Comando IPC (prova de conceito)

**Objetivo:** Validar que a comunicação Frontend ↔ Rust funciona.

**Implementar:**
- Comando Rust: `get_app_info() -> AppInfo { name, version }`
- Frontend: chamar o comando e exibir na tela

**Critério de aceite:**
- Frontend exibe nome e versão do app lidos do backend Rust
- TypeScript types alinhados com o struct Rust
- Teste unitário no Rust para o comando
- Teste no frontend para o componente que exibe a info

---

### 1.5 — CI Pipeline (GitHub Actions)

**Jobs:**

```yaml
ci:
  steps:
    # Setup
    - checkout
    - setup Node.js (via .nvmrc)
    - setup Rust toolchain (via rust-toolchain.toml)
    - cache: target/, node_modules/, ~/.cargo/registry

    # Lint
    - cargo fmt --check --all
    - cargo clippy --workspace -- -D warnings
    - npm run lint

    # Test + Coverage (Rust)
    - cargo tarpaulin --workspace --out xml --skip-clean
    - upload coverage → fail if < 80%

    # Test + Coverage (Frontend)
    - npm run test:coverage
    - fail if coverage < 80%

    # Type check
    - npm run typecheck
    - cargo test --workspace export_bindings (ts-rs validation)

    # Build
    - cargo tauri build (verificar que compila)
```

**Critério de aceite:**
- Push para `main` ou PR trigger executa o CI
- Pipeline verde com todos os checks passando
- **Coverage report** gerado e validado (threshold: 80%)
- PR bloqueado se coverage cair abaixo do threshold
- Badge de status no README (CI + coverage %)

---

### 1.6 — Documentação Inicial

**README.md deve conter:**
- Descrição do projeto
- Screenshots (placeholder)
- Pré-requisitos (Node.js, Rust, Tauri CLI)
- Instruções de setup (`npm install`, `cargo tauri dev`)
- Scripts disponíveis
- Link para ROADMAP.md
- Licença

**ADR-001:** Documentar decisão de usar Tauri v2 (vs Electron).
**ADR-002:** Documentar decisão de Cargo workspace com crates compartilhados.

---

## Estratégia de Testes

Testes são **cidadãos de primeira classe** neste projeto. Novas funcionalidades não podem quebrar funcionalidades anteriores. A cobertura é enforced no CI — PR não é mergeado se coverage cair.

### Pirâmide de Testes

```
            ╱╲
           ╱ E2E ╲            Poucos, lentos, fluxos críticos
          ╱────────╲
         ╱ Integração ╲       IPC, storage, stores
        ╱──────────────╲
       ╱   Unitários     ╲    Domínio, componentes, hooks
      ╱────────────────────╲   Muitos, rápidos, isolados
```

### Camadas de teste

| Camada | O que testa | Ferramenta | Onde vive |
|---|---|---|---|
| **Unit (Rust)** | Entidades, validações, regras de domínio, serialização | `cargo test` | `crates/*/src/**` (`#[cfg(test)]` inline) |
| **Unit (Frontend)** | Componentes, hooks, stores, utils | Vitest + Testing Library | `src/**/*.test.ts(x)` |
| **Integração (Rust)** | StorageEngine com filesystem real (tmpdir), atomic writes, lock | `cargo test` | `crates/*/tests/` |
| **Integração (Frontend)** | Stores + IPC mock, feature flows | Vitest | `src/**/*.integration.test.ts(x)` |
| **Contrato (ts-rs)** | TypeScript types alinhados com Rust structs | `cargo test` (ts-rs export) + CI diff | CI step dedicado |
| **Snapshot** | Serialização JSON estável (schema não quebra entre versões) | `cargo test` + `insta` | `crates/core/tests/` |
| **E2E** | Fluxos completos (criar notebook, editar, salvar, buscar) | Playwright | `e2e/flows/` |

### Ferramentas

**Rust:**
- `cargo test` — runner nativo
- `cargo-tarpaulin` — coverage (line + branch)
- `insta` — snapshot testing (JSON serialization stability)
- `tempfile` — diretórios temporários para testes de storage
- `assert_fs` — assertions sobre filesystem

**Frontend:**
- `vitest` — runner (compatível com Vite, rápido)
- `@testing-library/react` — renderização de componentes
- `@testing-library/user-event` — simulação de interação
- `msw` (Mock Service Worker) — mock de IPC calls do Tauri
- `c8` / `istanbul` — coverage report

**E2E:**
- `playwright` — automação de browser
- `@playwright/test` — runner + assertions

### Coverage Thresholds (enforced no CI)

| Escopo | Line Coverage | Branch Coverage |
|---|---|---|
| `crates/core` | **90%** | 80% |
| `crates/storage` | **85%** | 75% |
| `crates/search` | **80%** | 70% |
| `crates/sync` | **80%** | 70% |
| Frontend (global) | **80%** | 70% |

**Regras:**
- PR **não é mergeado** se coverage cair abaixo do threshold
- Coverage é medida **por crate** (Rust) e **global** (frontend)
- Novos arquivos sem testes geram warning no CI
- `crates/core` tem threshold mais alto porque é domínio puro — deve ser o mais testado

### Convenções de teste

**Rust — testes inline para unidade:**

```rust
// crates/core/src/workspace.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_workspace_with_valid_name() {
        let ws = Workspace::new("Meus Estudos", "/tmp/estudos");
        assert_eq!(ws.name, "Meus Estudos");
        assert!(!ws.id.is_nil());
    }

    #[test]
    fn reject_empty_workspace_name() {
        let result = Workspace::new("", "/tmp/empty");
        assert!(result.is_err());
    }
}
```

**Rust — testes de integração em `tests/`:**

```rust
// crates/storage/tests/engine_test.rs

use tempfile::TempDir;
use opennote_storage::FileSystemEngine;

#[test]
fn create_and_read_notebook() {
    let dir = TempDir::new().unwrap();
    let engine = FileSystemEngine::new(dir.path());

    let nb = engine.create_notebook("Estudos").unwrap();
    let loaded = engine.get_notebook(&nb.id).unwrap();

    assert_eq!(nb.id, loaded.id);
    assert_eq!(loaded.name, "Estudos");
}
```

**Frontend — co-located tests:**

```typescript
// src/features/navigation/Sidebar.test.tsx

import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';

test('renders notebook list', () => {
  render(<Sidebar notebooks={mockNotebooks} />);
  expect(screen.getByText('Meus Estudos')).toBeInTheDocument();
});
```

**E2E — fluxos críticos:**

```typescript
// e2e/flows/create-notebook.spec.ts

import { test, expect } from '@playwright/test';

test('user creates a notebook and adds a page', async ({ page }) => {
  await page.click('[data-testid="new-notebook"]');
  await page.fill('[data-testid="notebook-name"]', 'Estudos');
  await page.click('[data-testid="confirm"]');

  await expect(page.locator('.sidebar')).toContainText('Estudos');
});
```

### Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:rust": "cargo test --workspace",
    "test:rust:coverage": "cargo tarpaulin --workspace --out html --out xml",
    "test:all": "npm run test:rust && npm run test && npm run test:e2e",
    "lint": "eslint src/ --ext .ts,.tsx",
    "lint:rust": "cargo fmt --check --all && cargo clippy --workspace -- -D warnings",
    "lint:all": "npm run lint:rust && npm run lint",
    "typecheck": "tsc --noEmit"
  }
}
```

### Testes por Fase

Cada fase do ROADMAP define seus próprios testes no DoD. A regra geral:

| Fase | Foco dos testes |
|---|---|
| 01 | Infra: CI verde, 1 teste por camada |
| 02 | Domínio: entidades, CRUD, serialização, storage |
| 03 | UI: componentes, navegação, stores |
| 04 | Editor: blocos básicos, undo/redo, auto-save |
| 05 | Blocos avançados: cada tipo de bloco |
| 06 | Markdown: toggle, import/export |
| 07 | Ink: strokes, overlay, PDF |
| 08 | Busca: indexação, queries |
| 09 | Sync: providers, conflitos, merge |
| 10 | E2E: jornadas completas, regressão |

---

## Riscos desta Fase

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Tauri v2 breaking changes | Média | Alto | Fixar versão no Cargo.toml. Acompanhar changelog. |
| Incompatibilidade de versões (Node/Rust/Tauri) | Baixa | Médio | Documentar versões exatas no README. Usar `.nvmrc` e `rust-toolchain.toml`. |
| CI lento (build Rust) | Alta | Baixo | Cache de `target/` e `node_modules/` no GitHub Actions. |

---

## Definition of Done

- [ ] `cargo tauri dev` abre o app com placeholder funcional
- [ ] Hot reload funciona (frontend e backend)
- [ ] Cargo workspace configurado (`crates/core`, `crates/storage`, `crates/search`, `crates/sync`, `src-tauri`)
- [ ] Pelo menos 1 comando IPC funcionando (get_app_info)
- [ ] Testes passando: `cargo test --workspace` + `npm run test`
- [ ] Coverage report configurado (tarpaulin + vitest --coverage)
- [ ] Lint sem erros (ESLint + Clippy + Rustfmt)
- [ ] CI pipeline verde com coverage check
- [ ] README com instruções de setup
- [ ] ADR-001 escrita (Tauri v2)
- [ ] ADR-002 escrita (Cargo workspace + crates)
- [ ] Estrutura de diretórios criada

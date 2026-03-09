# Fase 01 — Workspace Registry (Domínio e Storage)

**Esforço estimado:** ~20 horas  
**Prioridade:** 🔴 Crítica  
**Dependências:** Nenhuma  
**Branch:** `feat/multi-workspace-phase-1`

---

## Objetivo

Estender o modelo de domínio (`crates/core`) e a camada de storage (`crates/storage`) para suportar o conceito de **múltiplos workspaces ativos** e um **registro centralizado** de workspaces abertos. Nenhuma mudança no frontend ou IPC nesta fase — apenas fundação.

---

## Contexto Atual

### `crates/core/src/settings.rs`
```rust
pub struct AppState {
    pub recent_workspaces: Vec<RecentWorkspace>,
    pub last_opened_workspace: Option<PathBuf>,  // singular
    pub global_settings: GlobalSettings,
}
```

### `crates/core/src/workspace.rs`
```rust
pub struct Workspace {
    pub id: WorkspaceId,
    pub name: String,
    pub root_path: PathBuf,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub settings: WorkspaceSettings,
}
```

O `AppState` trata um único workspace como ativo (`last_opened_workspace`). Não há conceito de múltiplos workspaces abertos simultaneamente.

---

## Tarefas

### 1.1 — Criar struct `ActiveWorkspace`

**Arquivo:** `crates/core/src/settings.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct ActiveWorkspace {
    pub id: WorkspaceId,
    pub path: PathBuf,
    pub name: String,
    pub opened_at: DateTime<Utc>,
}
```

**Critérios:**
- [ ] Struct derivando `Serialize`, `Deserialize`, `TS`
- [ ] Testes unitários de criação e serialização

---

### 1.2 — Estender `AppState` com campos multi-workspace

**Arquivo:** `crates/core/src/settings.rs`

```rust
pub struct AppState {
    pub recent_workspaces: Vec<RecentWorkspace>,
    pub active_workspaces: Vec<ActiveWorkspace>,       // NOVO
    pub focused_workspace_id: Option<WorkspaceId>,     // NOVO
    #[deprecated(note = "Use focused_workspace_id")]
    pub last_opened_workspace: Option<PathBuf>,        // MANTER para backward compat
    pub global_settings: GlobalSettings,
}
```

**Métodos novos em `impl AppState`:**

```rust
/// Adiciona workspace à lista de ativos (max 10)
pub fn activate_workspace(&mut self, id: WorkspaceId, path: PathBuf, name: String) { ... }

/// Remove workspace da lista de ativos
pub fn deactivate_workspace(&mut self, id: &WorkspaceId) { ... }

/// Define qual workspace está em foco
pub fn focus_workspace(&mut self, id: &WorkspaceId) -> Result<(), CoreError> { ... }

/// Retorna workspace ativo em foco
pub fn focused_workspace(&self) -> Option<&ActiveWorkspace> { ... }

/// Lista todos os workspaces ativos
pub fn list_active_workspaces(&self) -> &[ActiveWorkspace] { ... }
```

**Critérios:**
- [ ] Backward compatible: `last_opened_workspace` mantido, sincronizado com `focused_workspace_id`
- [ ] `activate_workspace` move para frente se já existir (sem duplicatas)
- [ ] Máximo de 10 workspaces ativos (const `MAX_ACTIVE_WORKSPACES`)
- [ ] `deactivate_workspace` atualiza `focused_workspace_id` se necessário (foca no próximo)
- [ ] Testes cobrindo: ativar, desativar, focar, limite, duplicata, serialização

---

### 1.3 — Atualizar `Default` para `AppState`

**Arquivo:** `crates/core/src/settings.rs`

O `Default` deve inicializar os novos campos:

```rust
impl Default for AppState {
    fn default() -> Self {
        Self {
            recent_workspaces: Vec::new(),
            active_workspaces: Vec::new(),
            focused_workspace_id: None,
            last_opened_workspace: None,
            global_settings: GlobalSettings::default(),
        }
    }
}
```

**Critérios:**
- [ ] `Default::default()` retorna estado vazio para todos os campos
- [ ] Testes existentes continuam passando

---

### 1.4 — Método `sync_legacy_fields` para backward compat

**Arquivo:** `crates/core/src/settings.rs`

```rust
impl AppState {
    /// Sincroniza campos legados com os novos para backward compatibility.
    /// Chamado após deserialização de JSON existente.
    pub fn sync_legacy_fields(&mut self) {
        // Se last_opened_workspace existe mas focused_workspace_id não,
        // tenta encontrar o workspace nos recentes e ativar
        if self.focused_workspace_id.is_none() {
            if let Some(ref path) = self.last_opened_workspace {
                if let Some(rw) = self.recent_workspaces.iter().find(|rw| &rw.path == path) {
                    // Criar um ActiveWorkspace provisório
                    // (sem id real — será resolvido ao abrir)
                }
            }
        }
        // Sincroniza focused → last_opened para apps legados
        if let Some(focused) = self.focused_workspace() {
            self.last_opened_workspace = Some(focused.path.clone());
        }
    }
}
```

**Critérios:**
- [ ] JSON antigo (sem `active_workspaces`) deserializa sem erro (campos default)
- [ ] Campos legados sincronizados corretamente
- [ ] Snapshot test (insta) para JSON antigo → novo

---

### 1.5 — Testes unitários domínio

**Arquivo:** `crates/core/src/settings.rs` (mod tests)

| Teste | Descrição |
|-------|-----------|
| `activate_single_workspace` | Ativa 1 workspace, verifica lista e foco |
| `activate_multiple_workspaces` | Ativa 3, verifica ordem e foco |
| `activate_duplicate_moves_to_front` | Ativar mesmo ID move para frente |
| `deactivate_workspace_updates_focus` | Desativar focado muda foco para próximo |
| `deactivate_last_workspace_clears_focus` | Desativar último limpa foco |
| `max_active_workspaces_enforced` | Ativar 11° remove o mais antigo |
| `focus_nonexistent_workspace_errors` | Focar em ID inexistente retorna erro |
| `sync_legacy_fields_from_old_format` | JSON sem `active_workspaces` funciona |
| `serialization_roundtrip` | Serializa → deserializa sem perda |
| `backward_compat_last_opened_synced` | `last_opened_workspace` sincronizado |

**Critérios:**
- [ ] 100% dos testes passando
- [ ] Coverage de domínio multi-workspace ≥ 90%

---

### 1.6 — TypeScript bindings atualizadas

**Ação:** Executar `cargo test -p opennote-core` para gerar novos bindings em `src/types/bindings/`

**Novos arquivos esperados:**
- `src/types/bindings/ActiveWorkspace.ts`

**Arquivos alterados:**
- `src/types/bindings/AppState.ts` (novos campos)

**Critérios:**
- [ ] `ActiveWorkspace.ts` gerado automaticamente por `ts-rs`
- [ ] `AppState.ts` contém `active_workspaces` e `focused_workspace_id`
- [ ] CI job "Verify TypeScript bindings" continua passando

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `crates/core/src/settings.rs` | Adição de struct, métodos, testes |
| `src/types/bindings/ActiveWorkspace.ts` | Novo (gerado) |
| `src/types/bindings/AppState.ts` | Alterado (gerado) |

## Arquivos NÃO Modificados (ainda)

- `crates/storage/` — Sem mudanças nesta fase
- `src-tauri/` — Sem mudanças nesta fase
- `src/stores/` — Sem mudanças nesta fase
- `src/components/` — Sem mudanças nesta fase

---

## Critérios de Aceitação da Fase

- [ ] `cargo test -p opennote-core` passa com todos os testes novos
- [ ] `cargo clippy --workspace -- -D warnings` sem warnings
- [ ] TypeScript bindings gerados e commitados
- [ ] JSON antigo (v1) deserializa sem erro
- [ ] Nenhuma breaking change em APIs públicas existentes
- [ ] PR review aprovado

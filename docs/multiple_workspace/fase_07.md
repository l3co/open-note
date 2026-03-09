# Fase 07 — Data Migration & Backward Compatibility

**Esforço estimado:** ~10 horas  
**Prioridade:** 🟡 Alta  
**Dependências:** Fase 01  
**Branch:** `feat/multi-workspace-phase-7`

---

## Objetivo

Garantir que workspaces criados na versão single-workspace (v1) migrem automaticamente para o novo formato multi-workspace (v2), sem perda de dados e sem ação manual do usuário.

---

## Cenários de Migração

### 1. `app_state.json` (global) — v1 → v2

**v1 (atual):**
```json
{
  "recent_workspaces": [
    { "path": "/home/user/notes", "name": "My Notes", "last_opened_at": "..." }
  ],
  "last_opened_workspace": "/home/user/notes",
  "global_settings": { ... }
}
```

**v2 (novo):**
```json
{
  "schema_version": 2,
  "recent_workspaces": [
    { "path": "/home/user/notes", "name": "My Notes", "last_opened_at": "..." }
  ],
  "active_workspaces": [],
  "focused_workspace_id": null,
  "last_opened_workspace": "/home/user/notes",
  "global_settings": { ... }
}
```

**Regra:** Campos ausentes recebem defaults via `#[serde(default)]`. O `last_opened_workspace` é mantido para forward compat.

### 2. `workspace.json` (por workspace) — sem mudança de schema

O `workspace.json` individual **não muda**. O `Workspace` struct permanece o mesmo. A mudança é apenas no `AppState` global.

### 3. Primeira abertura pós-update

Fluxo na inicialização:
1. Ler `app_state.json`
2. Se `schema_version` ausente ou < 2 → executar migração
3. Se `last_opened_workspace` presente mas `active_workspaces` vazio → migrar automaticamente
4. Salvar `app_state.json` no formato v2

---

## Tarefas

### 7.1 — Adicionar `schema_version` ao `AppState`

**Arquivo:** `crates/core/src/settings.rs`

```rust
pub struct AppState {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    // ... campos existentes + novos
}

fn default_schema_version() -> u32 {
    1  // Default para JSONs antigos sem o campo
}

pub const CURRENT_APP_STATE_VERSION: u32 = 2;
```

**Critérios:**
- [ ] JSON antigo sem `schema_version` deserializa como v1
- [ ] JSON novo inclui `schema_version: 2`

---

### 7.2 — Função de migração v1 → v2

**Arquivo:** `crates/storage/src/migrations/app_state_v2.rs`

```rust
use serde_json::Value;

/// Migra AppState de v1 (sem active_workspaces) para v2.
/// Função pura: recebe JSON Value, retorna JSON Value migrado.
pub fn migrate_app_state_v1_to_v2(mut state: Value) -> Value {
    let obj = state.as_object_mut().expect("AppState must be object");

    // Adicionar campos ausentes com defaults
    if !obj.contains_key("active_workspaces") {
        obj.insert("active_workspaces".into(), Value::Array(vec![]));
    }
    if !obj.contains_key("focused_workspace_id") {
        obj.insert("focused_workspace_id".into(), Value::Null);
    }

    // Atualizar schema_version
    obj.insert("schema_version".into(), Value::Number(2.into()));

    state
}
```

**Critérios:**
- [ ] Função pura (sem side effects)
- [ ] Idempotente (chamar 2x não quebra)
- [ ] Snapshot test (insta) comparando JSON antes/depois
- [ ] Campos existentes preservados intactos

---

### 7.3 — Pipeline de migração no storage engine

**Arquivo:** `crates/storage/src/engine.rs`

Adicionar lógica de migração ao `load_app_state`:

```rust
pub fn load_app_state() -> StorageResult<AppState> {
    let path = Self::app_state_path()?;
    if !path.exists() {
        return Ok(AppState::default());
    }

    // Ler como Value para verificar schema_version
    let raw: serde_json::Value = read_json(&path)?;
    let version = raw.get("schema_version")
        .and_then(|v| v.as_u64())
        .unwrap_or(1) as u32;

    let migrated = match version {
        1 => {
            let v2 = migrate_app_state_v1_to_v2(raw);
            // Salvar versão migrada
            atomic_write_json(&path, &v2)?;
            v2
        }
        2 => raw,
        other => return Err(StorageError::SchemaVersionMismatch {
            expected: CURRENT_APP_STATE_VERSION,
            found: other,
        }),
    };

    let state: AppState = serde_json::from_value(migrated)?;
    Ok(state)
}
```

**Critérios:**
- [ ] v1 → auto-migra e salva
- [ ] v2 → carrega direto
- [ ] Versão desconhecida → erro claro
- [ ] Arquivo original preservado (atomic write garante consistência)

---

### 7.4 — Backup antes da migração

**Arquivo:** `crates/storage/src/engine.rs`

Antes de migrar, criar backup:

```rust
fn backup_before_migration(path: &Path, from_version: u32) -> StorageResult<()> {
    let backup_name = format!(
        "{}.v{}.backup",
        path.file_name().unwrap().to_string_lossy(),
        from_version
    );
    let backup_path = path.with_file_name(backup_name);
    if !backup_path.exists() {
        std::fs::copy(path, &backup_path)?;
    }
    Ok(())
}
```

**Critérios:**
- [ ] Backup criado ANTES da migração
- [ ] Nome: `app_state.json.v1.backup`
- [ ] Não sobrescreve backup existente (idempotente)
- [ ] Teste: migração falha → arquivo original intacto

---

### 7.5 — Testes de migração

**Arquivo:** `crates/storage/src/migrations/app_state_v2.rs` (testes)  
**Arquivo:** `crates/storage/tests/migration_test.rs`

| Teste | Descrição |
|-------|-----------|
| `migrate_v1_minimal` | JSON v1 mínimo → v2 com campos default |
| `migrate_v1_with_data` | JSON v1 com recentes e settings → v2 preservado |
| `migrate_v1_idempotent` | Migrar 2x produz mesmo resultado |
| `migrate_v1_snapshot` | Snapshot test (insta) do JSON antes/depois |
| `load_v1_auto_migrates` | `load_app_state` com arquivo v1 retorna v2 |
| `load_v2_no_migration` | `load_app_state` com arquivo v2 não altera |
| `backup_created_before_migration` | Arquivo `.v1.backup` existe após migração |
| `unknown_version_errors` | `schema_version: 99` → erro |
| `corrupt_json_errors_gracefully` | JSON inválido → erro claro, não panic |
| `missing_file_returns_default` | Sem arquivo → `AppState::default()` |

**Critérios:**
- [ ] 100% dos cenários de migração cobertos
- [ ] Snapshot tests com `insta` para comparação visual
- [ ] Testes de integração com filesystem real (tempdir)

---

### 7.6 — Forward compatibility: `#[serde(default)]` em campos novos

**Arquivo:** `crates/core/src/settings.rs`

Todos os campos novos do `AppState` devem ter `#[serde(default)]`:

```rust
pub struct AppState {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    pub recent_workspaces: Vec<RecentWorkspace>,
    #[serde(default)]
    pub active_workspaces: Vec<ActiveWorkspace>,
    #[serde(default)]
    pub focused_workspace_id: Option<WorkspaceId>,
    pub last_opened_workspace: Option<PathBuf>,
    pub global_settings: GlobalSettings,
}
```

**Critérios:**
- [ ] `#[serde(default)]` em `active_workspaces` e `focused_workspace_id`
- [ ] JSON sem esses campos deserializa sem erro
- [ ] JSON com esses campos deserializa corretamente

---

### 7.7 — Documentação da migração

**Arquivo:** `docs/multiple_workspace/MIGRATION.md`

Documento para desenvolvedores explicando:
- Schema v1 vs v2
- Processo de migração automática
- Como testar migração localmente
- Rollback: restaurar backup manual

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `crates/core/src/settings.rs` | `schema_version`, `#[serde(default)]` |
| `crates/storage/src/migrations/app_state_v2.rs` | **Novo** — função de migração |
| `crates/storage/src/migrations/mod.rs` | Registrar novo módulo |
| `crates/storage/src/engine.rs` | Pipeline de migração no `load_app_state` |
| `crates/storage/tests/migration_test.rs` | **Novo** — testes de integração |
| `docs/multiple_workspace/MIGRATION.md` | **Novo** — documentação |

---

## Critérios de Aceitação da Fase

- [ ] Arquivo `app_state.json` v1 migra automaticamente para v2 na primeira abertura
- [ ] Backup criado antes da migração
- [ ] Nenhum dado perdido na migração
- [ ] App funciona normalmente após migração
- [ ] `cargo test --workspace` passa
- [ ] Snapshot tests aprovados
- [ ] PR review aprovado

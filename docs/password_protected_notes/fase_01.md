# Fase 01 — Domínio & Criptografia

**Esforço estimado:** ~16 horas
**Prioridade:** 🔴 Crítica
**Dependências:** Nenhuma
**Branch:** `feat/password-protected-notes-phase-1`

---

## Objetivo

Adicionar ao domínio (`crates/core`) as structs que representam proteção de page e, em
`crates/storage`, o serviço de criptografia (AES-256-GCM + Argon2id). Fazer o bump do
`schema_version` para 2, com migration backward-compatible. Ao final desta fase, o backend
consegue criptografar e descriptografar o conteúdo completo de pages (incluindo o título), mas
a feature ainda não está exposta ao frontend (isso é feito na Fase 2).

> **Decisão:** O **título também é criptografado**. No `.opn.json`, o campo `title` é substituído
> pelo placeholder `"[Página protegida]"` e `tags` fica `[]`. O payload criptografado contém
> `{ title, tags, blocks, annotations }`. O nome do arquivo (slug) não muda.

---

## Contexto Atual

```rust
// crates/core/src/page.rs — struct atual
pub struct Page {
    pub id: PageId,
    pub section_id: SectionId,
    pub title: String,
    pub tags: Vec<String>,
    pub blocks: Vec<Block>,
    pub annotations: PageAnnotations,
    pub editor_preferences: EditorPreferences,
    #[serde(default)]
    pub pdf_asset: Option<String>,
    #[serde(default)]
    pub pdf_total_pages: Option<u32>,
    #[serde(default)]
    pub canvas_state: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub schema_version: u32,  // = 1
}

// crates/storage/src/migrations.rs — padrão existente
pub fn migrate_app_state_if_needed(
    raw: serde_json::Value,
    path: &Path,
) -> StorageResult<serde_json::Value>
```

---

## Tarefas

### 1.1 — Adicionar structs de proteção em `crates/core`

**Arquivo:** `crates/core/src/page.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct PageProtection {
    pub algorithm: EncryptionAlgorithm,
    pub kdf: KeyDerivationFunction,
    pub kdf_params: KdfParams,
    pub salt: String,   // base64, 16 bytes aleatórios
    pub nonce: String,  // base64, 12 bytes aleatórios (AES-GCM IV)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
#[serde(rename_all = "snake_case")]
pub enum EncryptionAlgorithm {
    AesGcm256,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
#[serde(rename_all = "snake_case")]
pub enum KeyDerivationFunction {
    Argon2id,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct KdfParams {
    pub m_cost: u32,    // memória em KiB; recomendado: 65536 (64 MB)
    pub t_cost: u32,    // iterações; recomendado: 3
    pub p_cost: u32,    // paralelismo; recomendado: 1
    pub version: u32,   // versão Argon2; 19 = Argon2 v1.3
}

impl Default for KdfParams {
    fn default() -> Self {
        Self { m_cost: 65536, t_cost: 3, p_cost: 1, version: 19 }
    }
}
```

Modificar `Page` para incluir os novos campos com `#[serde(default)]`:

```rust
pub struct Page {
    // ... campos existentes sem mudança ...
    pub schema_version: u32,  // bump para 2

    #[serde(default)]
    pub protection: Option<PageProtection>,      // metadados de criptografia
    #[serde(default)]
    pub encrypted_content: Option<String>,       // ciphertext base64 {title, tags, blocks, annotations}
}

/// Placeholder gravado em disco no campo `title` quando a page está protegida.
/// O título real fica apenas dentro de `encrypted_content`.
pub const PROTECTED_TITLE_PLACEHOLDER: &str = "[Página protegida]";
```

Modificar `PageSummary`:

```rust
pub struct PageSummary {
    // ... campos existentes ...
    #[serde(default)]
    pub is_protected: bool,   // NOVO
}

impl From<&Page> for PageSummary {
    fn from(page: &Page) -> Self {
        Self {
            // ... campos existentes ...
            // title já é PROTECTED_TITLE_PLACEHOLDER quando protegida — nenhuma mudança aqui
            // tags já é [] quando protegida — nenhuma mudança aqui
            is_protected: page.protection.is_some(),  // NOVO
        }
    }
}
```

Atualizar constante:
```rust
pub const CURRENT_SCHEMA_VERSION: u32 = 2;  // era 1
```

**Critérios:**
- [ ] Structs implementam `Debug, Clone, Serialize, Deserialize, TS`
- [ ] `#[serde(default)]` em todos os campos novos (retrocompatibilidade)
- [ ] `PageSummary::from(&Page)` preenche `is_protected` corretamente
- [ ] Constante `PROTECTED_TITLE_PLACEHOLDER` exportada e usada em storage/commands
- [ ] Testes unitários de serialização/deserialização roundtrip

---

### 1.2 — Adicionar dependências de criptografia

**Arquivo:** `crates/storage/Cargo.toml`

```toml
[dependencies]
# criptografia
aes-gcm  = "0.10"
argon2   = "0.5"
rand     = "0.8"
base64   = "0.22"
```

> **Nota:** `argon2` crate usa Argon2id por padrão quando não especificado.
> `aes-gcm` provê AES-256-GCM com autenticação integrada (AEAD).

**Critérios:**
- [ ] `cargo build -p opennote-storage` compila sem erros
- [ ] Versões fixadas e compatíveis com `rust-toolchain.toml`

---

### 1.3 — Criar `EncryptionService` em `crates/storage`

**Arquivo:** `crates/storage/src/encryption.rs` (arquivo novo)

```rust
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use argon2::{Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use rand::RngCore;
use serde::{Deserialize, Serialize};

use opennote_core::annotation::PageAnnotations;
use opennote_core::block::Block;
use opennote_core::page::{EncryptionAlgorithm, KdfParams, KeyDerivationFunction, PageProtection};
use crate::error::{StorageError, StorageResult};

const KEY_LEN: usize = 32;    // AES-256
const SALT_LEN: usize = 16;   // 128 bits
const NONCE_LEN: usize = 12;  // 96 bits AES-GCM

/// Payload completo serializado e depois criptografado.
/// Inclui título real, tags, blocks e annotations.
#[derive(Serialize, Deserialize)]
pub struct EncryptedPayload {
    pub title: String,
    pub tags: Vec<String>,
    pub blocks: Vec<Block>,
    pub annotations: PageAnnotations,
}

pub struct EncryptionService;

impl EncryptionService {
    /// Gera metadados de proteção novos (salt e nonce aleatórios).
    pub fn new_protection() -> StorageResult<PageProtection> {
        let mut salt = [0u8; SALT_LEN];
        let mut nonce = [0u8; NONCE_LEN];
        OsRng.fill_bytes(&mut salt);
        OsRng.fill_bytes(&mut nonce);

        Ok(PageProtection {
            algorithm: EncryptionAlgorithm::AesGcm256,
            kdf: KeyDerivationFunction::Argon2id,
            kdf_params: KdfParams::default(),
            salt: B64.encode(salt),
            nonce: B64.encode(nonce),
        })
    }

    /// Deriva uma chave de 256 bits a partir da senha + metadados da proteção.
    pub fn derive_key(password: &str, protection: &PageProtection) -> StorageResult<Vec<u8>> {
        let salt = B64.decode(&protection.salt)
            .map_err(|_| StorageError::EncryptionError("Invalid base64 salt".into()))?;
        let p = &protection.kdf_params;
        let params = Params::new(p.m_cost, p.t_cost, p.p_cost, Some(KEY_LEN))
            .map_err(|e| StorageError::EncryptionError(e.to_string()))?;
        let argon2 = Argon2::new(
            argon2::Algorithm::Argon2id,
            Version::try_from(p.version)
                .map_err(|_| StorageError::EncryptionError("Invalid Argon2 version".into()))?,
            params,
        );
        let mut key = vec![0u8; KEY_LEN];
        argon2
            .hash_password_into(password.as_bytes(), &salt, &mut key)
            .map_err(|e| StorageError::EncryptionError(e.to_string()))?;
        Ok(key)
    }

    /// Criptografa o conteúdo JSON (plaintext) com a chave derivada.
    /// Retorna ciphertext codificado em base64.
    pub fn encrypt(plaintext: &[u8], key: &[u8], protection: &PageProtection) -> StorageResult<String> {
        let nonce_bytes = B64.decode(&protection.nonce)
            .map_err(|_| StorageError::EncryptionError("Invalid base64 nonce".into()))?;
        let cipher = Aes256Gcm::new_from_slice(key)
            .map_err(|e| StorageError::EncryptionError(e.to_string()))?;
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher
            .encrypt(nonce, plaintext)
            .map_err(|_| StorageError::EncryptionError("Encryption failed".into()))?;
        Ok(B64.encode(ciphertext))
    }

    /// Descriptografa ciphertext (base64) com a chave derivada.
    /// Retorna erro se a senha/chave for incorreta (autenticação AES-GCM falha).
    pub fn decrypt(ciphertext_b64: &str, key: &[u8], protection: &PageProtection) -> StorageResult<Vec<u8>> {
        let nonce_bytes = B64.decode(&protection.nonce)
            .map_err(|_| StorageError::EncryptionError("Invalid base64 nonce".into()))?;
        let ciphertext = B64.decode(ciphertext_b64)
            .map_err(|_| StorageError::EncryptionError("Invalid base64 ciphertext".into()))?;
        let cipher = Aes256Gcm::new_from_slice(key)
            .map_err(|e| StorageError::EncryptionError(e.to_string()))?;
        let nonce = Nonce::from_slice(&nonce_bytes);
        cipher
            .decrypt(nonce, ciphertext.as_ref())
            .map_err(|_| StorageError::EncryptionError("Decryption failed — wrong password?".into()))
    }
}
```

**Critérios:**
- [ ] `new_protection()` gera salt e nonce aleatórios a cada chamada
- [ ] `derive_key()` é determinístico (mesma senha + salt → mesma chave)
- [ ] `decrypt(encrypt(plaintext)) == plaintext`
- [ ] Senha errada em `decrypt()` retorna `StorageError::EncryptionError`, não panic

---

### 1.4 — Adicionar `EncryptionError` em `crates/storage`

**Arquivo:** `crates/storage/src/error.rs`

```rust
#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    // ... variantes existentes ...

    #[error("Encryption error: {0}")]
    EncryptionError(String),

    #[error("Wrong password")]
    WrongPassword,
}
```

**Critérios:**
- [ ] Variante `WrongPassword` para separar semanticamente senha errada de outros erros de criptografia
- [ ] Frontend pode distinguir `WRONG_PASSWORD` de outros erros de I/O

---

### 1.5 — Schema migration v1 → v2

**Arquivo:** `crates/storage/src/migrations.rs`

```rust
/// Migration de page schema v1 → v2
/// Adiciona campos `protection: null` e `encrypted_content: null`.
/// Como ambos têm `#[serde(default)]`, a migration é no-op para deserialização,
/// mas o schema_version precisa ser bumped ao re-salvar.
pub fn migrate_page_if_needed(raw: serde_json::Value) -> serde_json::Value {
    let version = raw.get("schema_version")
        .and_then(|v| v.as_u64())
        .unwrap_or(1) as u32;

    if version >= CURRENT_PAGE_SCHEMA_VERSION {
        return raw;
    }

    // v1 → v2: apenas bump de versão; campos novos têm default = null
    let mut migrated = raw;
    migrated["schema_version"] = serde_json::json!(CURRENT_PAGE_SCHEMA_VERSION);
    migrated
}
```

Usar `migrate_page_if_needed` dentro de `FsStorageEngine::load_page()`:

```rust
pub fn load_page(workspace_root: &Path, page_id: PageId) -> StorageResult<Page> {
    let path = Self::find_page_file(workspace_root, page_id)?;
    let raw: serde_json::Value = read_json(&path)?;
    let raw_version = raw.get("schema_version")
        .and_then(|v| v.as_u64())
        .unwrap_or(1) as u32;
    let migrated = migrate_page_if_needed(raw);
    let page: Page = serde_json::from_value(migrated)?;
    // Re-salva apenas se houve migration
    if raw_version < CURRENT_PAGE_SCHEMA_VERSION {
        atomic_write_json(&path, &page)?;
    }
    Ok(page)
}
```

**Critérios:**
- [ ] Pages v1 existentes carregam sem erro
- [ ] `schema_version` é atualizado para 2 quando a page é salva após migration
- [ ] `CURRENT_SCHEMA_VERSION` em `crates/core/src/page.rs` reflete 2

---

### 1.6 — Testes

**Arquivo:** `crates/storage/src/encryption.rs` (seção `#[cfg(test)]`)

| Teste | Descrição |
|-------|-----------|
| `encrypt_decrypt_roundtrip` | Criptografa e descriptografa → bytes idênticos |
| `wrong_password_returns_error` | Senha errada → `StorageError::EncryptionError` ou `WrongPassword` |
| `different_calls_produce_different_nonce` | `new_protection()` gera nonces únicos |
| `derive_key_is_deterministic` | Mesma senha + salt → mesma chave em duas derivações |
| `payload_roundtrip_includes_title_tags` | `EncryptedPayload` com title+tags serializa e deserializa corretamente |

**Arquivo:** `crates/core/src/page.rs` (seção `#[cfg(test)]`)

| Teste | Descrição |
|-------|-----------|
| `page_with_protection_serializes` | Page com `protection: Some(...)` serializa e deserializa corretamente |
| `page_v1_deserializes_without_protection` | JSON v1 sem campo `protection` deserializa com `protection: None` |
| `page_summary_is_protected_flag` | `PageSummary::from(&protected_page).is_protected == true` |
| `protected_page_title_is_placeholder` | Page com `protection: Some(...)` tem `title == PROTECTED_TITLE_PLACEHOLDER` |
| `protected_page_tags_are_empty` | Page com `protection: Some(...)` tem `tags == []` |

**Critérios:**
- [ ] `cargo test -p opennote-core` 100% passando
- [ ] `cargo test -p opennote-storage` 100% passando
- [ ] Coverage da `encryption.rs` ≥ 90%

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `crates/core/src/page.rs` | Alteração — novos campos `protection`, `encrypted_content`, `is_protected`; bump de `CURRENT_SCHEMA_VERSION` |
| `crates/storage/Cargo.toml` | Alteração — novas dependências `aes-gcm`, `argon2`, `rand`, `base64` |
| `crates/storage/src/lib.rs` | Alteração — expor `mod encryption` |
| `crates/storage/src/encryption.rs` | **Novo** — `EncryptionService` |
| `crates/storage/src/error.rs` | Alteração — novas variantes `EncryptionError`, `WrongPassword` |
| `crates/storage/src/migrations.rs` | Alteração — `migrate_page_if_needed()` |
| `crates/storage/src/engine.rs` | Alteração — `load_page()` chama migration |

## Arquivos NÃO Modificados (ainda)

- `src-tauri/src/commands/page.rs` — Commands IPC (Fase 2)
- `src-tauri/src/state.rs` — Session key cache (Fase 2)
- `src/stores/usePageStore.ts` — Store frontend (Fase 3)
- `src/components/` — UI (Fase 3)
- `crates/search/` — Exclusão de indexação (Fase 4)

---

## Critérios de Aceitação da Fase

- [ ] `cargo test --workspace` passa sem regressões
- [ ] `cargo clippy --workspace -- -D warnings` sem warnings
- [ ] Pages v1 existentes continuam carregando e salvando normalmente
- [ ] Roundtrip de criptografia verificado por testes unitários
- [ ] `npm run typecheck` sem erros (bindings TS gerados para `PageProtection`, `EncryptionAlgorithm`, `KeyDerivationFunction`, `KdfParams`)
- [ ] PR review aprovado

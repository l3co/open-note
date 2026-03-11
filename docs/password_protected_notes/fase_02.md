# Fase 02 — IPC Commands & Session Management

**Esforço estimado:** ~12 horas
**Prioridade:** 🔴 Crítica
**Dependências:** Fase 1
**Branch:** `feat/password-protected-notes-phase-2`

---

## Objetivo

Expor a funcionalidade de proteção por senha ao frontend via IPC, implementando:
- 4 novos commands: `set_page_password`, `remove_page_password`, `change_page_password`, `unlock_page`
- Modificação de `load_page` para retornar a page bloqueada (sem conteúdo) quando protegida
- Session key cache no `AppManagedState` para manter a chave derivada em memória durante a sessão
- `update_page_blocks` ciente de criptografia: re-criptografa antes de gravar

---

## Contexto Atual

```rust
// src-tauri/src/state.rs — estado atual
pub struct AppManagedState {
    pub workspace_root: Mutex<Option<PathBuf>>,
    pub save_coordinator: SaveCoordinator,
    pub search_engine: Mutex<Option<SearchEngine>>,
    pub sync_coordinator: Mutex<Option<SyncCoordinator>>,
    // sem session_keys
}

// src-tauri/src/commands/page.rs — load_page atual
#[tauri::command]
pub fn load_page(state: State<AppManagedState>, page_id: PageId) -> Result<Page, String> {
    let root = state.get_workspace_root()?;
    FsStorageEngine::load_page(&root, page_id).map_err(|e| e.to_string())
}

// src-tauri/src/commands/page.rs — update_page_blocks atual
#[tauri::command]
pub async fn update_page_blocks(
    state: State<'_, AppManagedState>,
    page_id: PageId,
    blocks: Vec<Block>,
) -> Result<Page, String> {
    let root = state.get_workspace_root()?;
    state
        .save_coordinator
        .with_page_lock(page_id, || {
            let mut page = FsStorageEngine::load_page(&root, page_id)?;
            page.blocks = blocks;
            page.updated_at = Utc::now();
            FsStorageEngine::update_page(&root, &page)?;
            Ok(page)
        })
        .await
        .map_err(|e| e.to_string())
}
```

---

## Tarefas

### 2.1 — Session key cache no `AppManagedState`

**Arquivo:** `src-tauri/src/state.rs`

```rust
use opennote_core::id::PageId;
use std::collections::HashMap;

pub struct AppManagedState {
    pub workspace_root: Mutex<Option<PathBuf>>,
    pub save_coordinator: SaveCoordinator,
    pub search_engine: Mutex<Option<SearchEngine>>,
    pub sync_coordinator: Mutex<Option<SyncCoordinator>>,
    /// Chaves AES-256 derivadas (em memória), indexadas por PageId.
    /// Limpas ao fechar o workspace.
    pub session_keys: Mutex<HashMap<PageId, Vec<u8>>>,  // NOVO
}

impl AppManagedState {
    pub fn new() -> Self {
        Self {
            workspace_root: Mutex::new(None),
            save_coordinator: SaveCoordinator::new(),
            search_engine: Mutex::new(None),
            sync_coordinator: Mutex::new(None),
            session_keys: Mutex::new(HashMap::new()),  // NOVO
        }
    }

    /// Guarda a chave derivada para a page na sessão.
    pub fn cache_key(&self, page_id: PageId, key: Vec<u8>) {
        if let Ok(mut keys) = self.session_keys.lock() {
            keys.insert(page_id, key);
        }
    }

    /// Retorna a chave em cache para a page (se desbloqueada nesta sessão).
    pub fn get_cached_key(&self, page_id: PageId) -> Option<Vec<u8>> {
        self.session_keys.lock().ok()?.get(&page_id).cloned()
    }

    /// Remove a chave da sessão (re-lock manual ou fecha workspace).
    pub fn evict_key(&self, page_id: PageId) {
        if let Ok(mut keys) = self.session_keys.lock() {
            keys.remove(&page_id);
        }
    }

    /// Limpa todas as chaves ao fechar o workspace.
    pub fn clear_session_keys(&self) {
        if let Ok(mut keys) = self.session_keys.lock() {
            keys.clear();
        }
    }
}
```

Chamar `clear_session_keys()` dentro do command `close_workspace`:

```rust
// src-tauri/src/commands/workspace.rs
pub fn close_workspace(state: State<AppManagedState>) -> Result<(), String> {
    // ... código existente de release de lock ...
    state.clear_session_keys();  // NOVO
    Ok(())
}
```

**Critérios:**
- [ ] `session_keys` inicializa vazio
- [ ] `close_workspace` limpa o cache
- [ ] Acesso thread-safe via `Mutex`

---

### 2.2 — Modificar `load_page` para retornar page bloqueada

**Arquivo:** `src-tauri/src/commands/page.rs`

Quando uma page está protegida e **não foi desbloqueada** nesta sessão, `load_page` retorna a
page com `blocks: []` e `annotations` vazio (a page no disco), sinalizando ao frontend que ela
está bloqueada. O campo `protection: Some(...)` indica ao frontend o que exibir.

```rust
#[tauri::command]
pub fn load_page(state: State<AppManagedState>, page_id: PageId) -> Result<Page, String> {
    let root = state.get_workspace_root()?;
    let page = FsStorageEngine::load_page(&root, page_id).map_err(|e| e.to_string())?;

    // Se a page está protegida e já foi desbloqueada nesta sessão, descriptografa em memória
    if let (Some(protection), Some(ciphertext)) = (&page.protection, &page.encrypted_content) {
        if let Some(key) = state.get_cached_key(page_id) {
            return decrypt_page_content(page, protection.clone(), ciphertext, &key);
        }
        // Não desbloqueada: retorna a page bloqueada (blocks vazios, protection Some)
        return Ok(page);
    }

    Ok(page)
}

/// Descriptografa o payload completo da page em memória.
/// Restaura título real, tags, blocks e annotations.
fn decrypt_page_content(
    mut page: Page,
    protection: PageProtection,
    ciphertext: &str,
    key: &[u8],
) -> Result<Page, String> {
    let plaintext = EncryptionService::decrypt(ciphertext, key, &protection)
        .map_err(|e| e.to_string())?;

    // EncryptedPayload é definido em crates/storage/src/encryption.rs
    let payload: EncryptedPayload = serde_json::from_slice(&plaintext)
        .map_err(|e| e.to_string())?;

    page.title = payload.title;           // TÍTULO REAL restaurado em memória
    page.tags = payload.tags;             // TAGS reais restauradas em memória
    page.blocks = payload.blocks;
    page.annotations = payload.annotations;
    Ok(page)
}
```

**Critérios:**
- [ ] Page não protegida: comportamento idêntico ao atual
- [ ] Page protegida + não desbloqueada: retorna com `title = PROTECTED_TITLE_PLACEHOLDER`, `blocks: []`, `tags: []`
- [ ] Page protegida + desbloqueada (chave em cache): retorna com título real, tags reais e blocks descriptografados

---

### 2.3 — Novo command: `unlock_page`

**Arquivo:** `src-tauri/src/commands/page.rs`

```rust
/// Desbloqueia uma page protegida. Deriva a chave, valida descriptografando,
/// armazena a chave na sessão e retorna a page com conteúdo completo.
#[tauri::command]
pub fn unlock_page(
    state: State<AppManagedState>,
    page_id: PageId,
    password: String,
) -> Result<Page, String> {
    let root = state.get_workspace_root()?;
    let page = FsStorageEngine::load_page(&root, page_id).map_err(|e| e.to_string())?;

    let protection = page.protection.as_ref()
        .ok_or_else(|| "Page is not protected".to_string())?;
    let ciphertext = page.encrypted_content.as_ref()
        .ok_or_else(|| "Page has no encrypted content".to_string())?;

    let key = EncryptionService::derive_key(&password, protection)
        .map_err(|e| e.to_string())?;

    // Tentar descriptografar valida a senha (AES-GCM autentica)
    let decrypted_page = decrypt_page_content(page, protection.clone(), ciphertext, &key)
        .map_err(|_| "WRONG_PASSWORD".to_string())?;

    // Senha correta — armazenar chave na sessão
    state.cache_key(page_id, key);

    Ok(decrypted_page)
}
```

**Critérios:**
- [ ] Senha correta → retorna `Page` com **título real**, tags reais e blocks descriptografados + armazena chave
- [ ] Senha incorreta → retorna erro `"WRONG_PASSWORD"` (string que o frontend trata via i18n)
- [ ] Page não protegida → retorna erro descritivo

---

### 2.4 — Novo command: `set_page_password`

**Arquivo:** `src-tauri/src/commands/page.rs`

```rust
/// Protege uma page com senha. Criptografa título, tags, blocks e annotations e salva em disco.
#[tauri::command]
pub async fn set_page_password(
    state: State<'_, AppManagedState>,
    page_id: PageId,
    password: String,
) -> Result<Page, String> {
    let root = state.get_workspace_root()?;

    let key_out = state
        .save_coordinator
        .with_page_lock(page_id, || {
            let mut page = FsStorageEngine::load_page(&root, page_id)?;

            if page.protection.is_some() {
                return Err(StorageError::EncryptionError(
                    "Page is already protected. Use change_page_password.".into(),
                ));
            }

            let protection = EncryptionService::new_protection()?;
            let key = EncryptionService::derive_key(&password, &protection)?;

            // Payload inclui TÍTULO REAL e TAGS
            let payload = EncryptedPayload {
                title: page.title.clone(),
                tags: page.tags.clone(),
                blocks: page.blocks.clone(),
                annotations: page.annotations.clone(),
            };
            let plaintext = serde_json::to_vec(&payload)?;
            let ciphertext = EncryptionService::encrypt(&plaintext, &key, &protection)?;

            // No disco: título vira placeholder, tags e blocks ficam vazios
            page.title = PROTECTED_TITLE_PLACEHOLDER.to_string();
            page.tags = vec![];
            page.blocks = vec![];
            page.annotations = PageAnnotations::default();
            page.protection = Some(protection);
            page.encrypted_content = Some(ciphertext);
            page.updated_at = Utc::now();

            FsStorageEngine::update_page(&root, &page)?;
            Ok(key)
        })
        .await
        .map_err(|e| e.to_string())?;

    // Cacheia a chave — usuário não precisa fazer unlock após definir a senha
    state.cache_key(page_id, key_out);
    Ok(())
}
```

**Critérios:**
- [ ] Page sem proteção → criptografa título+tags+blocks+annotations e salva
- [ ] Page já protegida → retorna erro claro
- [ ] No disco: `title = "[Página protegida]"`, `tags = []`, `blocks = []`, `annotations = default`
- [ ] Chave cacheada na sessão após `set_page_password` (usuário não precisa fazer unlock de novo)

---

### 2.5 — Novo command: `remove_page_password`

**Arquivo:** `src-tauri/src/commands/page.rs`

```rust
/// Remove a proteção por senha de uma page. Requer a senha atual.
#[tauri::command]
pub async fn remove_page_password(
    state: State<'_, AppManagedState>,
    page_id: PageId,
    password: String,
) -> Result<Page, String> {
    let root = state.get_workspace_root()?;

    state
        .save_coordinator
        .with_page_lock(page_id, || {
            let mut page = FsStorageEngine::load_page(&root, page_id)?;

            let protection = page.protection.clone()
                .ok_or_else(|| StorageError::EncryptionError("Page is not protected".into()))?;
            let ciphertext = page.encrypted_content.clone()
                .ok_or_else(|| StorageError::EncryptionError("Missing encrypted content".into()))?;

            let key = EncryptionService::derive_key(&password, &protection)?;
            let plaintext = EncryptionService::decrypt(&ciphertext, &key, &protection)
                .map_err(|_| StorageError::WrongPassword)?;

            let payload: EncryptedPayload = serde_json::from_slice(&plaintext)?;

            // Restaura todos os campos plaintext
            page.title = payload.title;
            page.tags = payload.tags;
            page.blocks = payload.blocks;
            page.annotations = payload.annotations;
            page.protection = None;
            page.encrypted_content = None;
            page.updated_at = Utc::now();

            FsStorageEngine::update_page(&root, &page)?;
            Ok(page)
        })
        .await
        .map_err(|e| e.to_string())
}
```

**Critérios:**
- [ ] Senha correta → restaura **título real**, tags, blocks e annotations em plaintext; remove `protection` e `encrypted_content`
- [ ] Senha incorreta → `"WRONG_PASSWORD"` (sem alterar o arquivo)
- [ ] Chave evictada do session cache após remoção de proteção

---

### 2.6 — Novo command: `change_page_password`

**Arquivo:** `src-tauri/src/commands/page.rs`

```rust
/// Troca a senha de uma page protegida.
/// Requer senha atual para descriptografar; re-criptografa com nova senha e novos salt/nonce.
#[tauri::command]
pub async fn change_page_password(
    state: State<'_, AppManagedState>,
    page_id: PageId,
    old_password: String,
    new_password: String,
) -> Result<(), String> {
    let root = state.get_workspace_root()?;

    state
        .save_coordinator
        .with_page_lock(page_id, || {
            let mut page = FsStorageEngine::load_page(&root, page_id)?;

            let old_protection = page.protection.clone()
                .ok_or_else(|| StorageError::EncryptionError("Page is not protected".into()))?;
            let ciphertext = page.encrypted_content.clone()
                .ok_or_else(|| StorageError::EncryptionError("Missing encrypted content".into()))?;

            let old_key = EncryptionService::derive_key(&old_password, &old_protection)?;
            let plaintext = EncryptionService::decrypt(&ciphertext, &old_key, &old_protection)
                .map_err(|_| StorageError::WrongPassword)?;

            // Re-criptografa com novos salt + nonce (rotação de chave)
            let new_protection = EncryptionService::new_protection()?;
            let new_key = EncryptionService::derive_key(&new_password, &new_protection)?;
            let new_ciphertext = EncryptionService::encrypt(&plaintext, &new_key, &new_protection)?;

            page.protection = Some(new_protection);
            page.encrypted_content = Some(new_ciphertext);
            page.updated_at = Utc::now();

            FsStorageEngine::update_page(&root, &page)?;
            Ok(())
        })
        .await
        .map_err(|e| e.to_string())?;

    // Atualiza cache com nova chave
    // (precisamos rederivá-la pois o lock foi liberado e o closure não retornou a chave)
    // Solução: evict e deixar o próximo load/unlock re-cachear
    state.evict_key(page_id);
    Ok(())
}
```

**Critérios:**
- [ ] Senha antiga incorreta → `"WRONG_PASSWORD"`
- [ ] Nova senha vazia → erro de validação
- [ ] Salt e nonce **rotacionados** (novos valores aleatórios na re-criptografia)
- [ ] Chave antiga evictada do cache após a mudança

---

### 2.7 — Modificar `update_page_blocks` para re-criptografar

**Arquivo:** `src-tauri/src/commands/page.rs`

```rust
#[tauri::command]
pub async fn update_page_blocks(
    state: State<'_, AppManagedState>,
    page_id: PageId,
    blocks: Vec<Block>,
) -> Result<Page, String> {
    let root = state.get_workspace_root()?;

    state
        .save_coordinator
        .with_page_lock(page_id, || {
            let mut page = FsStorageEngine::load_page(&root, page_id)?;
            page.updated_at = Utc::now();

            if let Some(protection) = page.protection.clone() {
                // Page protegida: re-criptografa com o mesmo nonce E mesma chave de sessão.
                // ATENÇÃO: nonce deve ser rotacionado a cada operação de encrypt para segurança máxima.
                // Aqui geramos um novo nonce a cada save.
                let key = state.get_cached_key(page_id)
                    .ok_or_else(|| StorageError::EncryptionError(
                        "Page is locked. Cannot save without unlock.".into(),
                    ))?;

                // Gera novo nonce para este save (evita reutilização)
                let mut new_nonce = [0u8; 12];
                rand::rngs::OsRng.fill_bytes(&mut new_nonce);
                use base64::{engine::general_purpose::STANDARD as B64, Engine};
                let new_protection = PageProtection {
                    nonce: B64.encode(new_nonce),
                    ..protection
                };

                // Descriptografa o conteúdo atual para obter o título e as tags reais
                let old_ciphertext = page.encrypted_content.clone()
                    .ok_or_else(|| StorageError::EncryptionError("Missing encrypted_content".into()))?;
                let old_plaintext = EncryptionService::decrypt(&old_ciphertext, &key, &protection)?;
                let mut payload: EncryptedPayload = serde_json::from_slice(&old_plaintext)?;

                // Atualiza apenas os blocks; título e tags permanecem do payload original
                payload.blocks = blocks;

                let plaintext = serde_json::to_vec(&payload)?;
                let ciphertext = EncryptionService::encrypt(&plaintext, &key, &new_protection)?;

                page.blocks = vec![];
                page.tags = vec![];
                page.protection = Some(new_protection);
                page.encrypted_content = Some(ciphertext);
            } else {
                page.blocks = blocks;
            }

            FsStorageEngine::update_page(&root, &page)?;
            Ok(page)
        })
        .await
        .map_err(|e| e.to_string())
}
```

**Critérios:**
- [ ] Page não protegida: comportamento idêntico ao atual
- [ ] Page protegida + chave em cache: re-criptografa com nonce novo antes de salvar
- [ ] Page protegida + sem chave em cache: retorna erro (nunca grava blocks vazios por acidente)

---

### 2.8 — Registrar novos commands no Tauri

**Arquivo:** `src-tauri/src/lib.rs`

```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        // ... commands existentes ...
        commands::page::unlock_page,
        commands::page::set_page_password,
        commands::page::remove_page_password,
        commands::page::change_page_password,
    ])
```

**Critérios:**
- [ ] Todos os 4 novos commands registrados
- [ ] `cargo build` sem erros após registro

---

### 2.9 — Wrappers TypeScript em `src/lib/ipc.ts`

**Arquivo:** `src/lib/ipc.ts`

```typescript
export const unlockPage = (pageId: string, password: string) =>
  invoke<Page>("unlock_page", { pageId, password });

export const setPagePassword = (pageId: string, password: string) =>
  invoke<Page>("set_page_password", { pageId, password });

export const removePagePassword = (pageId: string, password: string) =>
  invoke<Page>("remove_page_password", { pageId, password });

export const changePagePassword = (
  pageId: string,
  oldPassword: string,
  newPassword: string
) => invoke<void>("change_page_password", { pageId, oldPassword, newPassword });
```

**Critérios:**
- [ ] 4 wrappers exportados
- [ ] `npm run typecheck` sem erros

---

### 2.10 — Testes

**Arquivo:** `src-tauri/src/commands/page.rs` (integração)

| Teste | Descrição |
|-------|-----------|
| `set_and_unlock_page_restores_title` | Define senha → title no disco é placeholder → unlock retorna título real |
| `set_password_tags_hidden_on_disk` | Após proteger, `tags` fica `[]` no arquivo em disco |
| `wrong_password_unlock` | Unlock com senha errada → `"WRONG_PASSWORD"` |
| `remove_password_restores_title_and_content` | Remove senha → título real, tags e blocks restaurados no disco |
| `change_password_old_password_invalid` | Troca senha com senha antiga errada → erro |
| `update_blocks_on_protected_page_preserves_title` | Auto-save em page desbloqueada re-criptografa preservando título real |
| `update_blocks_locked_page_returns_error` | Auto-save sem chave em cache → erro sem corromper arquivo |

**Critérios:**
- [ ] Todos os testes passando
- [ ] `cargo test -p src-tauri` sem falhas

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src-tauri/src/state.rs` | Alteração — `session_keys: Mutex<HashMap<PageId, Vec<u8>>>` + métodos |
| `src-tauri/src/commands/page.rs` | Alteração — `load_page`, `update_page_blocks` + 4 novos commands |
| `src-tauri/src/commands/workspace.rs` | Alteração — `close_workspace` chama `clear_session_keys()` |
| `src-tauri/src/lib.rs` | Alteração — registrar 4 novos commands |
| `src/lib/ipc.ts` | Alteração — 4 novos wrappers TypeScript |

## Arquivos NÃO Modificados (ainda)

- `src/stores/usePageStore.ts` — Store (Fase 3)
- `src/components/` — UI, diálogos (Fase 3)
- `src/locales/` — i18n (Fase 3)
- `crates/search/` — Exclusão de indexação (Fase 4)

---

## Critérios de Aceitação da Fase

- [ ] `cargo test --workspace` passa sem regressões
- [ ] `cargo clippy --workspace -- -D warnings` sem warnings
- [ ] `npm run typecheck` sem erros
- [ ] Fechar workspace limpa todas as chaves de sessão
- [ ] PR review aprovado

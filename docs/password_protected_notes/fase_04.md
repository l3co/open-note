# Fase 04 — Search, Edge Cases & Testes

**Esforço estimado:** ~8 horas
**Prioridade:** 🟡 Alta
**Dependências:** Fase 3
**Branch:** `feat/password-protected-notes-phase-4`

---

## Objetivo

Garantir que a feature de proteção por senha se integra corretamente com as demais partes do
sistema — especialmente a busca full-text (Tantivy) — e que todos os edge cases estão cobertos
por testes automatizados. Esta fase também cobre polish de UX e documentação.

---

## Contexto Atual

```rust
// crates/search/src/extract.rs — extração de texto para indexação (simplificado)
pub fn extract_text_from_page(page: &Page) -> String {
    // itera page.blocks e extrai texto de cada bloco
    // para indexação no Tantivy
}

// crates/search/src/engine.rs — indexação
pub fn index_page(&self, page: &Page) -> Result<(), SearchError> {
    let text = extract_text_from_page(page);
    // insere no índice Tantivy: id, title, content (=text), tags
}

// src-tauri/src/commands/search.rs — reindex_page
pub fn reindex_page(state: State<AppManagedState>, page_id: PageId) -> Result<(), String> {
    let root = state.get_workspace_root()?;
    let page = FsStorageEngine::load_page(&root, page_id)?;
    let mut engine = state.search_engine.lock().unwrap();
    engine.as_mut()?.index_page(&page)?;
    Ok(())
}
```

---

## Tarefas

### 4.1 — Excluir pages protegidas completamente da busca full-text

**Arquivo:** `crates/search/src/extract.rs` e `crates/search/src/engine.rs`

Como o título também é criptografado, o campo `title` no disco é sempre `"[Página protegida]"`.
Indexar esse placeholder não tem valor e expõe ao usuário resultados confusos. Pages protegidas
devem ser **completamente removidas** do índice Tantivy.

```rust
// extract.rs — skip total do texto para pages protegidas
pub fn extract_text_from_page(page: &Page) -> String {
    if page.protection.is_some() {
        return String::new();
    }
    // ... lógica existente de extração dos blocks ...
}
```

```rust
// engine.rs — remove (ou não insere) page protegida do índice
pub fn index_page(&mut self, page: &Page) -> SearchResult<()> {
    if page.protection.is_some() {
        // Remove do índice caso já existisse antes de ser protegida
        let _ = self.delete_document(page.id);
        return Ok(());
    }
    // ... indexação normal com title, content, tags ...
}
```

**Critérios:**
- [ ] Pages protegidas não aparecem em nenhum resultado de busca (nem título, nem conteúdo)
- [ ] O placeholder `"[Página protegida]"` nunca é indexado no campo `title`
- [ ] Após remover proteção, a page é reindexada com título e conteúdo reais
- [ ] Rebuild do índice (`rebuild_index`) pula pages protegidas

---

### 4.2 — Reindexação após set/remove password

**Arquivo:** `src-tauri/src/commands/page.rs`

Após `set_page_password` e `remove_page_password`, o índice de busca precisa ser atualizado:
- `set_page_password`: reindexar a page (agora o conteúdo deve ser removido do índice)
- `remove_page_password`: reindexar a page (agora o conteúdo deve ser indexado)

```rust
// No final de set_page_password (após update_page):
if let Ok(mut engine) = state.search_engine.lock() {
    if let Some(engine) = engine.as_mut() {
        // Reindexar com blocks vazios (proteção ativa)
        let _ = engine.index_page(&page);
    }
}

// No final de remove_page_password (após update_page):
if let Ok(mut engine) = state.search_engine.lock() {
    if let Some(engine) = engine.as_mut() {
        let _ = engine.index_page(&page);
    }
}
```

**Critérios:**
- [ ] Após proteger uma page, ela desaparece completamente da busca (título e conteúdo)
- [ ] Após remover proteção, title real e conteúdo voltam a ser buscáveis

---

### 4.3 — Edge case: pages protegidas na lixeira

Quando uma page protegida é deletada (soft-delete para `.trash/`), ela vai para a lixeira como
um arquivo `.opn.json` ainda criptografado. Ao restaurar, continua protegida — comportamento
correto, sem mudanças necessárias.

**Verificar:** `delete_page` e `restore_from_trash` não precisam de alterações. Confirmar
nos testes de integração que o arquivo criptografado preserva o campo `protection` no `.opn.json`
dentro de `.trash/`.

**Critérios:**
- [ ] Deletar page protegida → arquivo na lixeira mantém `protection` e `encrypted_content`
- [ ] Restaurar page protegida → page continua protegida após restauração

---

### 4.4 — Edge case: mover page protegida entre sections

O command `move_page` copia o arquivo `.opn.json` para a nova section. Como a proteção está
no arquivo, ela é preservada automaticamente. Verificar que a chave de sessão ainda é válida
após o move (o `page_id` não muda).

**Critérios:**
- [ ] `move_page` de uma page protegida preserva `protection` e `encrypted_content`
- [ ] Chave em `session_keys` ainda funciona após move (mesmo `page_id`)

---

### 4.5 — Edge case: sync com cloud de pages protegidas

O `SyncCoordinator` trata arquivos `.opn.json` como blobs opacos — faz upload/download baseado
em hash SHA-256. Como o arquivo protegido é um JSON com `encrypted_content` (base64), ele sincroniza
normalmente sem necessidade de tratamento especial.

**Verificar:** que o campo `encrypted_content` não causa problemas no `SyncManifest` (o hash
muda a cada save por causa do nonce rotacionado — isso é correto e esperado).

**Sem mudanças necessárias** — apenas documentar e adicionar comentário no `SyncCoordinator`.

---

### 4.6 — Testes de integração (storage)

**Arquivo:** `crates/storage/tests/password_protection.rs` (arquivo novo)

```rust
use opennote_storage::engine::FsStorageEngine;
use opennote_storage::encryption::EncryptionService;
use tempfile::TempDir;

#[test]
fn set_and_verify_page_protection_in_file() {
    // Cria workspace temporário
    // Cria page
    // Define proteção via EncryptionService
    // Salva page com protection + encrypted_content
    // Lê o arquivo .opn.json diretamente e verifica que blocks está vazio
    // Verifica que protection e encrypted_content estão presentes
}

#[test]
fn protected_page_loads_with_placeholder_title_and_empty_blocks() {
    // Cria page com protection no filesystem (title="[Página protegida]")
    // load_page retorna title=="[Página protegida]", blocks==[], tags==[]
    // Descriptografa manualmente usando EncryptionService: verifica title real, blocks e tags originais
}

#[test]
fn page_migration_v1_to_v2_preserves_content() {
    // Salva um JSON v1 no filesystem
    // load_page → migration automática → schema_version = 2, blocks intactos
}
```

**Critérios:**
- [ ] Testes de integração com filesystem real (usando `tempfile::TempDir`)
- [ ] `cargo test -p opennote-storage` 100% passando

---

### 4.7 — Testes E2E (Playwright)

**Arquivo:** `e2e/password-protection.spec.ts` (arquivo novo)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Password-Protected Notes', () => {
  test('title becomes placeholder after protection, revealed after unlock', async ({ page }) => {
    // Cria page com título "Diário Pessoal", adiciona conteúdo
    // Right-click na page → "Proteger com senha" → define senha
    // Sidebar exibe "[Página protegida]" em itálico + ícone cadeado
    // Arquivo .opn.json: title=="[Página protegida]"
    // Clica na page → diálogo de senha genérico aparece (sem título)
    // Digita senha correta → editor mostra título real "Diário Pessoal"
  });

  test('section context menu lists and unlocks protected pages', async ({ page }) => {
    // Section com 2 pages protegidas
    // Right-click na Section → "Listar páginas protegidas"
    // Painel exibe 2 linhas com "[Página protegida]"
    // Desbloqueia uma → título real revelado na lista
    // Clica em "Abrir" → navega para a page com conteúdo
  });

  test('wrong password shows inline error without closing dialog', async ({ page }) => {
    // Page protegida, clica na sidebar
    // Diálogo de senha aparece com descrição genérica
    // Digita senha errada → erro inline "Senha incorreta"
    // Diálogo permanece aberto, campo senha limpo
  });

  test('remove protection restores real title in sidebar', async ({ page }) => {
    // Page protegida (title placeholder na sidebar)
    // Right-click → "Remover proteção" → digita senha correta
    // Sidebar mostra título real, sem cadeado
    // Page abre normalmente sem diálogo
  });
});
```

**Critérios:**
- [ ] Testes E2E passando com Tauri em modo de teste (ou mock de IPC)
- [ ] Screenshot do diálogo de senha capturado para documentação

---

### 4.8 — Documentação e atualizações

**Arquivos a atualizar:**

1. `docs/DATA_MODEL.md` — Adicionar `PageProtection`, campos novos de `Page` e `PageSummary`
2. `docs/IPC_REFERENCE.md` — Documentar os 4 novos commands
3. `CHANGELOG.md` — Entrada de feature

**Critérios:**
- [ ] `DATA_MODEL.md` reflete schema v2
- [ ] `IPC_REFERENCE.md` tem os 4 novos commands documentados
- [ ] `CHANGELOG.md` atualizado

---

### 4.9 — Validação de senha mínima no backend

**Arquivo:** `crates/core/src/page.rs` ou `crates/storage/src/encryption.rs`

```rust
pub fn validate_password(password: &str) -> Result<(), StorageError> {
    if password.len() < 6 {
        return Err(StorageError::EncryptionError(
            "Password must be at least 6 characters".into(),
        ));
    }
    Ok(())
}
```

Chamar `validate_password` no início de `set_page_password` e `change_page_password`.

**Critérios:**
- [ ] Backend rejeita senhas com menos de 6 caracteres
- [ ] Frontend também valida (Fase 3), mas backend é a fonte da verdade

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `crates/search/src/extract.rs` | Alteração — skip completo para pages protegidas |
| `crates/search/src/engine.rs` | Alteração — `index_page` remove page protegida do índice |
| `src-tauri/src/commands/page.rs` | Alteração — reindexar após set/remove password |
| `crates/storage/tests/password_protection.rs` | **Novo** — testes de integração |
| `e2e/password-protection.spec.ts` | **Novo** — testes E2E |
| `docs/DATA_MODEL.md` | Alteração — schema v2, novos tipos |
| `docs/IPC_REFERENCE.md` | Alteração — 4 novos commands |
| `CHANGELOG.md` | Alteração — entrada de feature |

## Arquivos NÃO Modificados

- `crates/sync/` — Sync não precisa de mudanças
- `crates/storage/src/engine.rs` — `delete_page` e `restore_from_trash` sem mudanças

---

## Critérios de Aceitação da Fase (e da Feature Completa)

- [ ] `cargo test --workspace` passa sem regressões
- [ ] `cargo clippy --workspace -- -D warnings` sem warnings
- [ ] `npm run typecheck` sem erros
- [ ] `npm test` sem falhas
- [ ] Testes E2E passando
- [ ] Pages protegidas não aparecem em nenhum resultado de busca (título nem conteúdo)
- [ ] O placeholder `"[Página protegida]"` nunca é indexado no Tantivy
- [ ] Deletar/restaurar page protegida preserva a proteção
- [ ] Sincronização com cloud funciona sem tratamento especial
- [ ] Documentação atualizada (DATA_MODEL, IPC_REFERENCE, CHANGELOG)
- [ ] PR review aprovado

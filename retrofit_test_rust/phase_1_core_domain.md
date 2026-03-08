# Fase 1: Domínio e Lógica de Negócios (Crate `core`)

Esta fase foca em garantir que os modelos de domínio (Entities) preservem os invariantes internos independentemente da infraestrutura. A abordagem de teste aqui é puramente em memória, sendo de curtíssima duração.

**Testes existentes:** ~23 (page, notebook, section, block, id, trash, error)

## 🧪 Cenários de Teste a Serem Implementados

### 1. Modelo `Page` (`crates/core/src/page.rs`)

- [ ] **`test_rename_page_validation`**: 
  - *Contexto*: `Page::rename()` falha se o nome estiver vazio.
  - *Cenário*: Tentar renomear para `""` e apenas espaços `"   "`. Garantir que o erro disparado seja do tipo `CoreError::Validation`.
  - *Nota*: O teste `reject_empty_page_title` valida `Page::new()`, mas não existe teste para `rename()`.

- [ ] **`test_rename_updates_timestamp`**:
  - *Contexto*: `Page::rename()` deve atualizar `updated_at`.
  - *Cenário*: Criar página → aguardar 1ms → chamar `rename("Novo Título")` → verificar `updated_at > created_at`.

- [ ] **`test_add_tag_updates_timestamp`**:
  - *Contexto*: `add_tag` atualiza `updated_at` ao adicionar nova tag.
  - *Cenário*: Criar página → guardar `updated_at` → aguardar 1ms → `add_tag("estudo")` → verificar `updated_at` mudou.

- [ ] **`test_add_tag_duplicate_does_not_update_timestamp`**:
  - *Contexto*: Tag duplicada (case-insensitive) é ignorada.
  - *Cenário*: `add_tag("rust")` → guardar `updated_at` → `add_tag("RUST")` → verificar `updated_at` **não mudou**.

- [ ] **`test_add_tag_empty_string_is_noop`**:
  - *Contexto*: Tags vazias ou só espaços devem ser ignoradas.
  - *Cenário*: `add_tag("")` e `add_tag("   ")` → verificar `tags.len() == 0` e `updated_at` inalterado.

- [ ] **`test_remove_tag_nonexistent_does_not_update_timestamp`**:
  - *Contexto*: Remover tag inexistente não deve alterar estado.
  - *Cenário*: `remove_tag("inexistente")` retorna `false`, `updated_at` não muda.

- [ ] **`test_add_block_updates_timestamp`**:
  - *Contexto*: `add_block` atualiza `updated_at`.
  - *Cenário*: Criar página → aguardar 1ms → `add_block(divider)` → verificar `updated_at > created_at`.

### 2. Modelo `Id` — Type Safety

> **Nota:** `test_unicode_slug_generation` foi movido para a **Fase 2** (`phase_2_storage_engine.md`),
> pois a geração de slugs/paths a partir de títulos acontece no `crates/storage`, não no `crates/core`.

- [ ] **`test_id_type_safety_across_newtypes`**:
  - *Contexto*: O newtype pattern (`PageId(Uuid)`, `NotebookId(Uuid)`) deve impedir uso cruzado.
  - *Cenário*: Verificar que `PageId` e `NotebookId` são tipos distintos em tempo de compilação. Criar um `PageId` e garantir que não pode ser passado onde `NotebookId` é esperado (teste de compilação negativa via `trybuild`, ou assertiva de `TypeId` diferente).

- [ ] **`test_id_parse_from_string`**:
  - *Cenário*: `PageId::from_uuid(Uuid::parse_str("..."))` funciona com UUID válido. Deserializar de JSON com UUID inválido retorna erro.

### 3. Modelo `TrashItem`

- [ ] **`test_trash_expiration_boundary_exact`**:
  - *Contexto*: Um arquivo fica na lixeira por padrão 30 dias (`DEFAULT_TRASH_RETENTION_DAYS`).
  - *Cenário*: Criar `TrashManifest` com dois itens:
    - Item A: `expires_at` = agora - 1 segundo → **purgado**
    - Item B: `expires_at` = agora + 1 segundo → **retido**
  - Chamar `remove_expired(now)` e verificar que apenas A é removido.
  - *Nota*: O teste existente `remove_expired_items` usa `Duration::days(1)`. Este teste valida a fronteira exata (±1 segundo).

### 4. Modelo `Notebook` e `Section`

- [ ] **`test_notebook_rename_trims_whitespace`**:
  - *Cenário*: `Notebook::rename("  Novo  ")` → `name == "Novo"` (verificar trim).

- [ ] **`test_section_validation_empty_name`**:
  - *Cenário*: `Section::new("")` e `Section::new("   ")` devem retornar `CoreError::Validation`.

## 🧰 Técnicas

- **Property-based Testing (opcional, via `proptest`)** para varrer o domínio de Title string inputs testando crashes por caracteres esotéricos (emojis, RTL, zero-width chars).
- **Isolamento Total**: Mocks e drivers não são necessários nesta camada. Testes puramente síncronos e extremamente velozes.
- **`insta`**: Snapshot testing para serialização JSON de `Page`, `Block`, `TrashItem` — garante que mudanças no schema são intencionais.

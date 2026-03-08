# Fase 2: Motor de Armazenamento (`crates/storage`)

Esta fase cuida da materialização dos nossos modelos (`FsStorageEngine`). O armazenamento por sistema de arquivos pode falhar por miríades de fatores além do código, o que exige foco de QA em Falhas Parciais, Locks de Concorrência e Tratamento Exaustivo de Erros.

**Testes existentes:** ~95 (engine CRUD, atomic write, lock, integration)

## 🧪 Cenários de Teste a Serem Implementados

### 1. Concorrência e File Locking (`lock.rs` | `engine.rs`)

- [ ] **`test_concurrent_workspace_open_multithread`**:
  - *Contexto*: O `open_workspace` cria um `.lock` com PID.
  - *Cenário*: Thread A chama `acquire_lock`. Thread B tenta `acquire_lock` simultaneamente na mesma raiz.
  - *Expectativa*: Exatamente uma thread recebe `StorageError::WorkspaceLocked`, a outra sucede.
  - *Nota*: O teste unitário `acquire_lock_fails_if_already_locked_by_self` já existe, mas é single-thread. Este cenário adiciona contention real via `std::thread::spawn`.

> **Já coberto:** `test_stale_lock_recovery` — o teste `stale_lock_is_removed` em `lock.rs` já simula lock falsificado com PID inexistente (999_999_999) e verifica recuperação. Não é necessário duplicar.

### 2. Sanitização de Paths e Unicode (movido da Fase 1)

- [ ] **`test_unicode_title_to_safe_path`**:
  - *Contexto*: Quando o storage cria Notebooks/Sections/Pages, usa títulos do usuário para gerar nomes de diretório/arquivo.
  - *Cenário*: Nomes com emojis (`"📚 Estudos"`), acentuação pesada (`"Análise de Currículos"`), pontos (`"v2.0 Notes"`), e barras (`"Meu/Nome/Ruim"`).
  - *Expectativa*: Paths gerados são válidos no filesystem, sem Path Traversal (`../`), sem caracteres ilegais.
  - **⚠️ Segurança**: Testar que títulos como `"../../etc/passwd"`, `".\\.\\secret"` e `"CON"` (Windows reserved) são sanitizados.

- [ ] **`test_path_collision_handling`**:
  - *Cenário*: Criar dois notebooks com nomes que geram o mesmo slug (ex: `"Notas"` e `"notas"`). A engine deve gerar paths distintos ou retornar erro claro.

### 3. Tratamento de Falhas e I/O Resiliência

- [ ] **`test_corrupted_json_recovery_on_entities`**: 
  - *Contexto*: Atualmente testam que o parse da `Page` falha caso o JSON esteja quebrado.
  - *Cenário*: O que acontece ao abrir a subárvore se o `workspace.json` ou o `section.json` estiverem zerados ou parcialmente gravados? A app deve conseguir listar os demais elementos e reportar isoladamente o arquivo problemático, e não crashear o workspace inteiro.
  - *Implementação*: Criar workspace válido via engine → sobrescrever `section.json` com `"{broken"` → chamar `list_sections()` → verificar que retorna erro granular, não panic.

- [ ] **`test_corrupted_page_json_does_not_crash_notebook`**:
  - *Cenário*: Workspace com 3 pages. Corromper o JSON de uma delas. `list_pages()` deve retornar as 2 válidas (ou reportar a corrompida separadamente), sem perder as demais.

- [ ] **`test_atomic_write_no_temp_file_residue`**:
  - *Contexto*: `atomic_write_bytes` usa padrão `.tmp` → `rename`.
  - *Cenário*: Após write bem-sucedido, verificar que o `.tmp` não persiste. Após write com conteúdo grande (>1MB), verificar integridade.
  - *Nota*: Simular interrupção mid-rename requer abstração de trait sobre `std::fs` (refatoração prévia). Este teste cobre o caminho feliz com rigor.

### 4. Edge Cases do Módulo Trash

- [ ] **`test_cleanup_expired_trash_deletes_physical_files`**:
  - *Contexto*: Função `cleanup_expired_trash(workspace_root) -> StorageResult<u32>`.
  - *Cenário*: Fabricar manualmente (via `atomic::write_json`) elementos no `trash_manifest.json` com datas de exclusão modificadas no passado e no futuro. Criar os arquivos físicos correspondentes em `.trash/`. Rodar o cleanup e auditar:
    - Arquivos expirados foram deletados do filesystem
    - Arquivos não expirados permanecem
    - Manifesto foi atualizado corretamente
    - Retorno indica quantidade correta de itens purgados
  - *Nota*: O teste `remove_expired_items` no `crates/core` valida apenas o manifesto em memória. Este teste valida o fluxo completo com I/O real.

### 5. Permissões

- [ ] **`test_read_only_workspace`**:
  - *Cenário*: Setar `tempdir` como read-only (`fs::set_permissions`) após criá-lo. Tentar chamar `create_page` ou `create_notebook`. Deve retornar `StorageError` de IO sem panic.
  - *Nota*: Este teste pode ser `#[cfg(unix)]` pois permissões read-only funcionam diferente no Windows.

### 6. Migrações de Schema

- [ ] **`test_migration_v1_to_v2_preserves_data`**:
  - *Contexto*: Migrações em `crates/storage/src/migrations/` — funções puras `fn migrate_v1_to_v2(Value) -> Value`.
  - *Cenário*: Criar JSON fixture no formato v1. Rodar migração. Verificar que o resultado é válido no formato v2, preservando todos os dados do usuário.
  - *Técnica*: Usar `insta` para snapshot do JSON migrado.

## 🧰 Técnicas

- **`tempfile`** com multithreading para concorrência.
- **Fault injection** via fixtures JSON corrompidas.
- **`insta`** para snapshots de arquivos JSON migrados.
- **`#[cfg(unix)]`** para testes de permissão (cross-platform awareness).

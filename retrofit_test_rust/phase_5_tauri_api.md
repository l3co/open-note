# Fase 5: Contratos Tauri API (`src-tauri`)

Sendo o Tauri a principal ponte de comunicação com o Frontend React, a responsabilidade dessa camada é serialização de JSONs, parsing e orquestração dos comandos em background evitando falhas sistêmicas na interface.

**Testes existentes:** ~2 (state.rs)

## ⚠️ Contexto Importante

- A camada `src-tauri` é **fina** — os commands delegam para os crates (`core`, `storage`, `search`, `sync`).
- O Tauri v2 lida com serialização/deserialização automaticamente via `serde`. Payloads JSON inválidos já retornam erro ao frontend sem panic.
- O foco aqui **não é testar a deserialização** (o Tauri já faz isso), mas sim garantir que **erros de domínio são propagados como strings legíveis** e que o **estado compartilhado é thread-safe**.
- **Eventos para o frontend** (`app_handle.emit()`) **não estão implementados** atualmente. Testes de emissão de eventos devem ser adicionados quando essa funcionalidade for construída.

---

## 🧪 Cenários de Teste a Serem Implementados

### 1. Propagação de Erros de Domínio (`commands/`)

- [ ] **`test_create_notebook_empty_name_returns_validation_error`**:
  - *Contexto*: O command `create_notebook` delega para `FsStorageEngine::create_notebook`, que valida o nome via `Notebook::new()`. Se vazio, retorna `CoreError::Validation`.
  - *Cenário*: Chamar o command com `name: ""`.
  - *Expectativa*: Retorna `Err(String)` contendo "Validation error" — a string legível que o frontend captura via `catch`. Sem panic.

- [ ] **`test_create_page_empty_title_returns_validation_error`**:
  - *Cenário*: Chamar `create_page` com `title: ""`.
  - *Expectativa*: Mesma validação — `Err(String)` legível.

- [ ] **`test_open_workspace_invalid_path_returns_io_error`**:
  - *Cenário*: Chamar `open_workspace` com path inexistente.
  - *Expectativa*: Retorna `Err(String)` com mensagem de I/O — não panic.

- [ ] **`test_error_strings_are_human_readable`**:
  - *Cenário*: Coletar as strings de erro retornadas por commands inválidos (notebook vazio, page vazia, path inexistente). Verificar que contêm informação útil (não são stack traces, não são structs serializados, são mensagens legíveis).

### 2. State App Integrity e Segurança de Thread

- [ ] **`test_save_coordinator_concurrent_page_writes`**:
  - *Contexto*: `SaveCoordinator` em `state.rs` usa `Mutex` per-page para proteção de writes concorrentes.
  - *Cenário*: Disparar N threads simultâneas chamando `update_page_blocks` para a **mesma page**. Verificar que todas completam sem deadlock e que o estado final é consistente (última write vence).

- [ ] **`test_managed_state_none_returns_graceful_error`**:
  - *Contexto*: `AppManagedState` usa `Mutex<Option<T>>` para `SearchEngine` e `SyncCoordinator`. Antes de `open_workspace`, esses são `None`.
  - *Cenário*: Chamar `search_pages` antes de abrir workspace.
  - *Expectativa*: Retorna erro legível ("No workspace open" ou similar), não panic por `unwrap()` em `None`.

### 3. Consistência de Tipos IPC (ts-rs)

- [ ] **`test_typescript_bindings_are_up_to_date`**:
  - *Contexto*: `ts-rs` com `#[derive(TS)]` gera bindings TypeScript. Se a struct Rust mudar e os bindings não forem regenerados, o frontend usa tipos desatualizados.
  - *Cenário*: Rodar `cargo test` com `ts-rs` — ele valida que os bindings exportados existem e são coerentes com as structs. Se houver drift, o teste falha.
  - *Nota*: Pode ser um CI check (`cargo test -- --test ts_bindings` ou script que compara generated vs committed).

## 🧰 Técnicas

- **`tauri::test`**: API de teste do Tauri v2 para criar `AppHandle` mock e invocar commands.
- **`std::thread::spawn`**: Para testes de concorrência no `SaveCoordinator`.
- **Assertivas em strings de erro**: Verificar que erros retornados contêm substrings esperadas (ex: `assert!(err.contains("Validation"))`).

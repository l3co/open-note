# Fase 4: Sincronização em Nuvem (`crates/sync`)

Sincronizar arquivos pode gerar um pesadelo de perda de dados de usuário (*User Data Loss*). O `Coordinator` será posto à prova em cenários hostis de rede.

**Testes existentes:** ~21 (coordinator defaults, preferences, collect_local_files, excludes, manifest)

## ⚠️ Estado Atual da Implementação

Antes de escrever testes, é importante saber o que **já existe** e o que **ainda não existe**:

- ✅ `SyncCoordinator`: `collect_local_files`, `resolve_conflict`, `set_provider`, preferences
- ✅ `SyncManifest`: save/load/update/remove com hashing SHA-256
- ✅ `detect_changes()`: compara manifesto local vs remote → `FileChangeKind`
- ✅ `resolve_conflict()`: file-level (KeepLocal, KeepRemote, KeepBoth) com I/O real
- ❌ **Sync flow** (upload/download/delete): **não implementado** — providers são stubs
- ❌ **Merge CRDT de blocos**: **não existe** — conflitos são tratados a nível de arquivo
- ❌ **Event emission**: backend não emite eventos de progresso para o frontend

Os testes devem focar no que **já pode ser testado** e preparar o terreno (MockProvider) para quando o sync flow for implementado.

---

## 🧪 Cenários de Teste a Serem Implementados

### 1. MockProvider (Pré-requisito para os demais testes)

- [ ] **Criar `MockProvider` implementando `SyncProvider` trait**:
  - *Contexto*: Os providers reais (Google Drive, OneDrive, Dropbox) são stubs que retornam `AuthRequired`. Precisamos de um mock controlável.
  - *Implementação*:
    ```rust
    struct MockProvider {
        files: HashMap<String, Vec<u8>>,
        should_fail: Option<SyncError>,
        fail_on_nth_call: Option<usize>,
    }
    ```
  - O mock deve implementar todos os métodos do trait `SyncProvider` (auth, list, upload, download, delete, create_directory).
  - Usar `Arc<Mutex<MockProvider>>` para inspecionar estado após operações.

### 2. Resolução de Conflitos (File-Level)

- [ ] **`test_resolve_conflict_keep_local`**:
  - *Cenário*: Fabricar um `SyncConflict` com `local_path` e `conflict_path`. Criar ambos os arquivos no tempdir. Chamar `resolve_conflict(id, KeepLocal)`.
  - *Expectativa*: O arquivo de conflito é deletado. O arquivo local permanece. O conflito é removido da lista.

- [ ] **`test_resolve_conflict_keep_remote`**:
  - *Cenário*: Mesma preparação. Chamar `resolve_conflict(id, KeepRemote)`.
  - *Expectativa*: O arquivo de conflito é renomeado sobre o local (substituição). O conflito é removido da lista.

- [ ] **`test_resolve_conflict_keep_both`**:
  - *Cenário*: Mesma preparação. Chamar `resolve_conflict(id, KeepBoth)`.
  - *Expectativa*: Ambos os arquivos permanecem. O conflito é removido da lista.

- [ ] **`test_resolve_conflict_nonexistent_id_returns_error`**:
  - *Cenário*: Chamar `resolve_conflict("fake-id", KeepLocal)`.
  - *Expectativa*: Retorna `SyncError::Storage` com mensagem "Conflict not found".

- [ ] **`test_resolve_conflict_updates_pending_count`**:
  - *Cenário*: Adicionar 3 conflitos. Resolver 1. Verificar `status.pending_conflicts == 2`.

### 3. Detecção de Mudanças (Manifest)

- [ ] **`test_detect_changes_local_only`**:
  - *Cenário*: Arquivo existe localmente mas não no manifesto remoto.
  - *Expectativa*: `FileChangeKind::LocalOnly`.

- [ ] **`test_detect_changes_both_modified`**:
  - *Cenário*: Mesmo arquivo com hashes diferentes no manifesto local e remoto.
  - *Expectativa*: `FileChangeKind::BothModified`.

- [ ] **`test_detect_changes_unchanged`**:
  - *Cenário*: Mesmo arquivo com mesmo hash em ambos os manifestos.
  - *Expectativa*: `FileChangeKind::Unchanged`.

### 4. Tolerância a Erros de Autenticação

- [ ] **`test_provider_auth_expired_returns_clean_error`**:
  - *Cenário*: Configurar `MockProvider` para retornar `SyncError::AuthExpired` em qualquer operação. Chamar método que usa o provider.
  - *Expectativa*: O coordinator propaga `SyncError::AuthExpired` sem retry loop. O status reflete o erro. O manifesto local **não é alterado**.

- [ ] **`test_auth_token_expiry_check`**:
  - *Cenário*: Criar `AuthToken` com `expires_at` no passado e no futuro. Verificar `is_expired()`.

### 5. Injeção de Falha de Rede *(parcialmente bloqueado pelo sync flow)*

- [ ] **`test_manifest_not_updated_on_partial_failure`**:
  - *Cenário*: Usando `MockProvider` que falha após N operações bem-sucedidas (`fail_on_nth_call`). Verificar que o manifesto local só é salvo quando **todas** as operações completam com sucesso.
  - *Nota*: Este teste valida o princípio de atomicidade do sync. Pode ser implementado quando o sync flow existir, mas o MockProvider e a assertiva de manifesto podem ser preparados agora.

## 🧰 Técnicas

- **MockProvider**: `struct` que implementa `SyncProvider` com comportamento controlável (erros injetáveis, estado inspecionável).
- **`tempfile`**: Para criar workspaces e arquivos de conflito reais.
- **Manifest fixtures**: Fabricar manifestos JSON com timestamps e hashes controlados via `atomic::write_json`.

# Fase 2 — Sync Permission Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantir que arquivos baixados via `sync_bidirectional` tenham permissões corretas (`0o644`) e que falhas de sync sejam visíveis ao usuário via toast, em vez de serem silenciadas.

**Architecture:** Dois pontos de mudança independentes: (1) `src-tauri/src/commands/sync.rs` — adicionar `chmod 0o644` após escrita de arquivo no `sync_bidirectional`, e remover `let _ =` silenciadores; (2) `src/lib/ipc.ts` + componentes sync — propagar erros ao invés de retornar silêncio.

**Tech Stack:** Rust (Tauri v2), TypeScript, React, `sonner` (já no projeto), `cargo test`, Vitest.

---

## Arquivo Map

| Ação | Arquivo |
|---|---|
| Modify | `src-tauri/src/commands/sync.rs` |
| Modify | `src/lib/ipc.ts` |
| Modify | `src/components/sync/SyncSettings.tsx` (ou o componente que chama sync) |
| Test (Rust) | `crates/sync/src/` — testes inline existentes |

---

### Task 1: Adicionar `chmod 0o644` em `sync_bidirectional`

**Files:**
- Modify: `src-tauri/src/commands/sync.rs` (linhas 726–754 aproximadamente)

**Contexto:** `download_workspace` já tem `chmod 0o644` (linhas 517–524). `sync_bidirectional` faz `std::fs::write` sem definir permissões — o arquivo fica com as permissões padrão do `umask`, que podem ser `0o600` em certos contextos macOS.

- [ ] **Step 1: Escrever teste Rust para verificar permissões após write**

Adicione ao final do arquivo `crates/storage/src/atomic.rs` (antes do `}` que fecha `mod tests`):

```rust
#[test]
fn atomic_write_sets_readable_permissions() {
    use std::os::unix::fs::PermissionsExt;
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("test.json");
    atomic_write_json(&path, &"hello").unwrap();
    let mode = std::fs::metadata(&path).unwrap().permissions().mode();
    // Verifica que owner pode ler (0o400) e escrever (0o200)
    assert!(mode & 0o600 == 0o600, "file must be owner-readable and writable, got mode {mode:o}");
}
```

- [ ] **Step 2: Rodar o teste (vai passar — atomic_write já é correto)**

```bash
cargo test -p opennote-storage -- atomic_write_sets_readable_permissions --nocapture
```

Esperado: PASS. O `atomic_write` já usa `fs::File::create` que herda umask. Esse teste documenta o comportamento esperado. Se falhar em algum ambiente restrito, sinaliza o problema.

- [ ] **Step 3: Localizar o bloco `RemoteOnly | RemoteModified` em `sync_bidirectional`**

Em `src-tauri/src/commands/sync.rs`, encontre o bloco (aproximadamente linha 726):

```rust
FileChangeKind::RemoteOnly | FileChangeKind::RemoteModified => {
    if let Some(rf) = remote_by_path.get(&change.path) {
        match provider.download_remote_file(&token, rf).await {
            Ok(content) => {
                if let Some(parent) = local_path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                match std::fs::write(&local_path, &content) {
                    Ok(()) => {
                        let local_hash = compute_hash(&content);
                        manifest.update_entry(
                            &change.path,
                            SyncFileEntry { ... },
                        );
                        downloaded += 1;
                    }
                    Err(e) => errors.push(format!("Write {}: {}", change.path, e)),
                }
            }
            Err(e) => errors.push(format!("Download {}: {}", change.path, e)),
        }
    }
}
```

- [ ] **Step 4: Adicionar `chmod 0o644` após o `std::fs::write` bem-sucedido**

Substitua o bloco `Ok(()) => { ... downloaded += 1; }` por:

```rust
Ok(()) => {
    // Garante permissão de leitura/escrita pelo dono, independente do umask.
    // Sem isto, arquivos baixados podem ter 0o600 e bloquear abertura posterior.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(
            &local_path,
            std::fs::Permissions::from_mode(0o644),
        );
    }
    let local_hash = compute_hash(&content);
    manifest.update_entry(
        &change.path,
        SyncFileEntry {
            local_hash: local_hash.clone(),
            remote_hash: rf.hash.clone(),
            local_modified_at: chrono::Utc::now(),
            remote_modified_at: rf.modified_at,
            synced_at: chrono::Utc::now(),
        },
    );
    downloaded += 1;
}
```

- [ ] **Step 5: Compilar para verificar que não há erros**

```bash
cargo build --workspace 2>&1 | head -50
```

Esperado: sem erros de compilação.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/sync.rs crates/storage/src/atomic.rs
git commit -m "fix(sync): set 0o644 permissions on files downloaded via sync_bidirectional"
```

---

### Task 2: Remover `let _ =` silenciadores em `connect_provider` e `disconnect_provider`

**Files:**
- Modify: `src-tauri/src/commands/sync.rs`

**Contexto:** Quando `with_workspace_mut` falha (ex: sync coordinator não inicializado), o erro é descartado silenciosamente. Isso torna impossível debugar falhas de configuração pós-autenticação.

- [ ] **Step 1: Corrigir `connect_provider` (linhas ~71–82)**

Encontre o bloco:
```rust
if let Ok(Some(id)) = state.get_focused_id() {
    let _ = state.with_workspace_mut(&id, |ctx| {
        if let Some(ref mut coord) = ctx.sync_coordinator {
            let mut prefs = coord.get_preferences().clone();
            prefs.provider = Some(provider_type);
            prefs.enabled = true;
            coord.set_provider(providers::create_provider(provider_type));
            coord.set_preferences(prefs);
        }
        Ok(())
    });
}
```

Substitua por:
```rust
if let Ok(Some(id)) = state.get_focused_id() {
    if let Err(e) = state.with_workspace_mut(&id, |ctx| {
        if let Some(ref mut coord) = ctx.sync_coordinator {
            let mut prefs = coord.get_preferences().clone();
            prefs.provider = Some(provider_type);
            prefs.enabled = true;
            coord.set_provider(providers::create_provider(provider_type));
            coord.set_preferences(prefs);
        }
        Ok(())
    }) {
        log::warn!("[connect_provider] Falha ao atualizar coordinator: {e}");
    }
}
```

- [ ] **Step 2: Corrigir `disconnect_provider` (linhas ~102–113)**

Encontre o bloco:
```rust
if let Ok(Some(id)) = state.get_focused_id() {
    let _ = state.with_workspace_mut(&id, |ctx| {
        if let Some(ref mut coord) = ctx.sync_coordinator {
            coord.clear_provider();
            let mut prefs = coord.get_preferences().clone();
            prefs.provider = None;
            prefs.enabled = false;
            coord.set_preferences(prefs);
        }
        Ok(())
    });
}
```

Substitua por:
```rust
if let Ok(Some(id)) = state.get_focused_id() {
    if let Err(e) = state.with_workspace_mut(&id, |ctx| {
        if let Some(ref mut coord) = ctx.sync_coordinator {
            coord.clear_provider();
            let mut prefs = coord.get_preferences().clone();
            prefs.provider = None;
            prefs.enabled = false;
            coord.set_preferences(prefs);
        }
        Ok(())
    }) {
        log::warn!("[disconnect_provider] Falha ao atualizar coordinator: {e}");
    }
}
```

- [ ] **Step 3: Verificar que `log` está disponível no crate `src-tauri`**

```bash
grep -r "log" src-tauri/Cargo.toml
```

Se não estiver, adicione ao `src-tauri/Cargo.toml`:
```toml
log = "0.4"
```

- [ ] **Step 4: Compilar**

```bash
cargo build --workspace 2>&1 | head -50
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/sync.rs src-tauri/Cargo.toml
git commit -m "fix(sync): propagate coordinator update errors instead of silencing with let _ ="
```

---

### Task 3: Descobrir e ajustar o componente sync que abre workspace baixado

**Files:**
- Modify: Componente que chama `openWorkspace` após download (a identificar com grep)

**Contexto:** O usuário baixa o workspace via `download_workspace` (que já tem chmod) e depois tenta abri-lo. O ponto de falha é provavelmente na abertura do workspace após o download.

- [ ] **Step 1: Encontrar onde o workspace baixado é aberto**

```bash
grep -rn "download_workspace\|openWorkspace\|local_path\|DownloadResult" src/ --include="*.tsx" --include="*.ts"
```

Anote os arquivos e linhas retornados.

- [ ] **Step 2: Verificar se há tratamento de erro ao abrir**

Procure o padrão `catch` ou `try` na função que chama `openWorkspace` após o download. Se o erro for silenciado ou não exibido ao usuário, adicione um toast:

```tsx
import { toast } from "sonner";

try {
  await openWorkspace(result.local_path);
} catch (err) {
  toast.error(`Não foi possível abrir o workspace baixado: ${err instanceof Error ? err.message : String(err)}`);
}
```

- [ ] **Step 3: Verificar se há toast em falhas de `connectProvider`**

```bash
grep -rn "connectProvider\|connect_provider" src/ --include="*.tsx" --include="*.ts"
```

No componente que chama `connectProvider`, garanta que erros são exibidos:

```tsx
try {
  const email = await connectProvider(providerName);
  toast.success(`Conectado como ${email}`);
} catch (err) {
  toast.error(`Falha ao conectar: ${err instanceof Error ? err.message : String(err)}`);
}
```

- [ ] **Step 4: Rodar lint e typecheck**

```bash
npm run lint && npm run typecheck
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "fix(sync): show error toast when workspace open or provider connect fails"
```

---

### Task 4: Rodar testes completos e validar

- [ ] **Step 1: Rodar todos os testes**

```bash
npm run test:all
```

Esperado: PASS.

- [ ] **Step 2: Rodar lint completo**

```bash
npm run lint:all
```

Esperado: sem erros ou warnings novos.

- [ ] **Step 3: Validar no app**

```bash
npm run tauri dev
```

- Conectar ao Google Drive ou Dropbox
- Baixar um workspace existente
- Abrir o workspace baixado
- Verificar que o workspace abre sem erro de permissão
- Se falhar, o erro agora aparece como toast descritivo

---

## Critério de conclusão

Arquivo sincronizado abre sem erro de permissão em macOS. Falhas de sync (conexão, download, abertura) exibem toast com mensagem descritiva. `cargo test --workspace` e `npm run test` passam.

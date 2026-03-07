# Fase 09 — Cloud Sync

## Objetivo

Implementar **sincronização bidirecional** entre o workspace local e provedores de armazenamento em nuvem (Google Drive, OneDrive, Dropbox). O sync é **opt-in** — o app funciona 100% offline sem conta ou configuração de nuvem.

---

## Dependências

- Fase 02 concluída (modelo de domínio + storage)

---

## Entregáveis

1. Arquitetura de sync engine abstraída por provider
2. Integração com Google Drive API
3. Integração com OneDrive API (Microsoft Graph)
4. Integração com Dropbox API
5. Autenticação OAuth2 para cada provider
6. Detecção de conflitos e estratégia de resolução
7. Sync seletivo (escolher quais notebooks sincronizar)
8. UI de configuração de sync
9. Indicadores de status de sync
10. Sync em background com intervalo configurável

---

## Princípios de Design

| Princípio | Descrição |
|---|---|
| **Opt-in** | Sync desabilitado por padrão. Usuário escolhe ativar. |
| **Offline-first** | App funciona 100% sem internet. Sync é oportunístico. |
| **Não destrutivo** | Sync nunca apaga dados locais sem confirmação explícita. |
| **Transparente** | Usuário sempre sabe o que está sincronizado e o que não está. |
| **Provider-agnostic** | Engine de sync abstrai diferenças entre providers. |

---

## Arquitetura

```
┌──────────────────────────────────────────┐
│              Sync Engine                 │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │         SyncCoordinator          │    │
│  │  - detecta mudanças locais       │    │
│  │  - detecta mudanças remotas      │    │
│  │  - resolve conflitos             │    │
│  │  - orquestra upload/download     │    │
│  └──────────────────────────────────┘    │
│             │                            │
│  ┌──────────┴───────────────────┐        │
│  │      SyncProvider (trait)     │        │
│  ├──────────────────────────────┤        │
│  │  GoogleDriveProvider         │        │
│  │  OneDriveProvider            │        │
│  │  DropboxProvider             │        │
│  └──────────────────────────────┘        │
└──────────────────────────────────────────┘
```

### Trait SyncProvider

```rust
#[async_trait]
trait SyncProvider: Send + Sync {
    /// Nome do provider (para UI)
    fn name(&self) -> &str;
    
    /// Autenticar (abre browser para OAuth2)
    async fn authenticate(&mut self) -> Result<AuthToken>;
    
    /// Verificar se autenticado e token válido
    async fn is_authenticated(&self) -> bool;
    
    /// Revogar autenticação
    async fn revoke(&mut self) -> Result<()>;
    
    /// Listar arquivos remotos com metadata (path, hash, modified_at)
    async fn list_remote_files(&self, remote_path: &str) -> Result<Vec<RemoteFile>>;
    
    /// Download de arquivo
    async fn download_file(&self, remote_path: &str) -> Result<Vec<u8>>;
    
    /// Upload de arquivo
    async fn upload_file(&self, remote_path: &str, content: &[u8]) -> Result<RemoteFile>;
    
    /// Deletar arquivo remoto
    async fn delete_file(&self, remote_path: &str) -> Result<()>;
    
    /// Obter metadata de arquivo remoto
    async fn get_file_metadata(&self, remote_path: &str) -> Result<Option<RemoteFile>>;
}

struct RemoteFile {
    path: String,
    hash: String,            // content hash para detectar mudanças
    size: u64,
    modified_at: DateTime<Utc>,
}
```

---

## Autenticação OAuth2

### Fluxo

```
1. Usuário clica "Conectar Google Drive"
2. App abre browser com URL de autorização OAuth2
3. Usuário autoriza no browser
4. Redirect para localhost (Tauri captura)
5. App troca code por access_token + refresh_token
6. Tokens armazenados de forma segura (keychain/keyring do OS)
```

### Armazenamento de Tokens

**Nunca em plain text no filesystem.**

Opções:
1. **macOS:** Keychain via `security-framework` crate
2. **Windows:** Credential Manager via `keyring` crate
3. **Linux:** Secret Service (GNOME Keyring / KDE Wallet) via `keyring` crate

**Crate Rust:** `keyring` (cross-platform)

```rust
use keyring::Entry;

fn store_token(provider: &str, token: &str) -> Result<()> {
    let entry = Entry::new("open-note", &format!("sync-{}", provider))?;
    entry.set_password(token)?;
    Ok(())
}

fn get_token(provider: &str) -> Result<Option<String>> {
    let entry = Entry::new("open-note", &format!("sync-{}", provider))?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.into()),
    }
}
```

### Configuração OAuth2 por Provider

#### Google Drive

- **Scopes:** `https://www.googleapis.com/auth/drive.file` (apenas arquivos criados pelo app)
- **API:** Google Drive API v3
- **Endpoints:**
  - Auth: `https://accounts.google.com/o/oauth2/v2/auth`
  - Token: `https://oauth2.googleapis.com/token`
  - Files: `https://www.googleapis.com/drive/v3/files`

#### OneDrive

- **Scopes:** `Files.ReadWrite.AppFolder` (pasta específica do app)
- **API:** Microsoft Graph API
- **Endpoints:**
  - Auth: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
  - Token: `https://login.microsoftonline.com/common/oauth2/v2.0/token`
  - Files: `https://graph.microsoft.com/v1.0/me/drive/`

#### Dropbox

- **Scopes:** `files.content.write`, `files.content.read`
- **API:** Dropbox API v2
- **Endpoints:**
  - Auth: `https://www.dropbox.com/oauth2/authorize`
  - Token: `https://api.dropboxapi.com/oauth2/token`
  - Files: `https://api.dropboxapi.com/2/files/`

**Nota:** Cada provider requer registro de app (client_id/client_secret). Documentar processo no README.

---

## Estratégia de Sync

### Estrutura Remota

```
/OpenNote/                         # Pasta raiz no cloud
  ├── sync_state.json              # Estado do sync
  └── meu-notebook/                # Espelha estrutura local
       ├── notebook.json
       └── estudos/
            ├── section.json
            ├── aula-01.opn.json
            └── assets/
                 └── img-abc123.png
```

A estrutura remota é **idêntica** à local. Isso permite:
- Sync simples (arquivo por arquivo)
- Recuperação manual (copiar pasta do cloud)
- Interoperabilidade (outro dispositivo com Open Note)

### Detecção de Mudanças

#### Mudanças Locais

Manter `sync_manifest.json` local com hash de cada arquivo sincronizado:

```json
{
  "files": {
    "meu-notebook/estudos/aula-01.opn.json": {
      "local_hash": "sha256:abc123...",
      "remote_hash": "sha256:abc123...",
      "local_modified_at": "2026-03-07T14:30:00Z",
      "remote_modified_at": "2026-03-07T14:30:00Z",
      "synced_at": "2026-03-07T14:30:05Z"
    }
  }
}
```

**Mudança local detectada quando:** `current_hash != sync_manifest.local_hash`

#### Mudanças Remotas

- Listar arquivos remotos com metadata (hash, modified_at)
- Comparar com `sync_manifest.remote_hash`
- **Mudança remota detectada quando:** `remote_hash != sync_manifest.remote_hash`

### Ciclo de Sync

```
1. Listar arquivos locais modificados desde último sync
2. Listar arquivos remotos modificados desde último sync
3. Categorizar cada arquivo:
   a. LOCAL_ONLY → Upload
   b. REMOTE_ONLY → Download
   c. LOCAL_MODIFIED → Upload (se remoto não mudou)
   d. REMOTE_MODIFIED → Download (se local não mudou)
   e. BOTH_MODIFIED → CONFLITO
   f. LOCAL_DELETED → Delete remoto (se remoto não mudou)
   g. REMOTE_DELETED → Delete local (se local não mudou)
   h. UNCHANGED → Skip
4. Executar ações (upload, download, delete)
5. Atualizar sync_manifest.json
```

### Resolução de Conflitos

**Conflito:** Arquivo modificado tanto local quanto remotamente desde o último sync.

**Estratégia:** **Não perder dados. Sempre.**

```
1. Manter versão local
2. Baixar versão remota como {filename}.conflict.{timestamp}.opn.json
3. Notificar usuário: "Conflito detectado em 'Aula 01'. Revise as duas versões."
4. Usuário decide manualmente qual manter
5. Após resolução, arquivo de conflito é removido
```

**Alternativa futura (avançada):** CRDT-based merge para blocos individuais. Complexo demais para o momento.

---

## Sync Seletivo

O usuário pode escolher **quais notebooks sincronizar**:

```
Configurações de Sync:
  Google Drive (conectado ✓)
  
  Notebooks sincronizados:
    ☑ Notebook A      — 12 pages, 45 MB
    ☐ Notebook B      — 3 pages, 2 MB    ← não sincronizado
    ☑ Notebook C      — 28 pages, 120 MB
  
  [Sincronizar agora]
```

**Regra:** Apenas notebooks selecionados são enviados/recebidos. Os demais ficam exclusivamente locais.

---

## Sync em Background

### Intervalo

- Padrão: a cada 5 minutos (configurável)
- Opções: 1 min, 5 min, 15 min, 30 min, 1h, manual only
- Sync também disparado ao salvar uma page (com debounce de 30s)

### Implementação

```rust
// Background sync loop
tokio::spawn(async move {
    let mut interval = tokio::time::interval(Duration::from_secs(300));
    loop {
        interval.tick().await;
        if let Err(e) = sync_engine.sync().await {
            log::error!("Sync failed: {}", e);
            emit_sync_error(e);
        }
    }
});
```

### Retry com Backoff

Se sync falhar (sem internet, erro de API):
1. Retry após 30s
2. Retry após 1 min
3. Retry após 5 min
4. Parar tentativas, notificar usuário
5. Resumir no próximo ciclo normal

---

## Comandos Tauri IPC

| Comando | Input | Output |
|---|---|---|
| `get_sync_providers` | — | `Vec<ProviderInfo>` |
| `connect_provider` | `provider: String` | `AuthResult` |
| `disconnect_provider` | `provider: String` | `()` |
| `get_sync_status` | — | `SyncStatus` |
| `sync_now` | — | `SyncResult` |
| `set_sync_config` | `SyncPreferences` | `()` |
| `get_sync_config` | — | `SyncPreferences` |
| `resolve_conflict` | `conflict_id, resolution` | `()` |
| `get_conflicts` | — | `Vec<SyncConflict>` |

### Tipos

```rust
struct ProviderInfo {
    name: String,              // "google_drive", "onedrive", "dropbox"
    display_name: String,      // "Google Drive"
    connected: bool,
    user_email: Option<String>,
    last_synced_at: Option<DateTime<Utc>>,
}

struct SyncStatus {
    is_syncing: bool,
    provider: Option<String>,
    progress: Option<SyncProgress>,
    last_synced_at: Option<DateTime<Utc>>,
    last_error: Option<String>,
    pending_conflicts: u32,
}

struct SyncProgress {
    phase: String,            // "uploading", "downloading", "comparing"
    current: u32,
    total: u32,
}

struct SyncPreferences {
    enabled: bool,
    provider: Option<String>,
    interval_seconds: u64,
    synced_notebook_ids: Vec<NotebookId>,
}

struct SyncConflict {
    id: String,
    page_title: String,
    local_modified_at: DateTime<Utc>,
    remote_modified_at: DateTime<Utc>,
    local_path: String,
    conflict_path: String,
}

enum ConflictResolution {
    KeepLocal,
    KeepRemote,
    KeepBoth,  // renomeia local para "Page (local)" e remote para "Page (remote)"
}
```

---

## Migração de Workspace (Local ↔ Cloud)

O app é local-first: todo workspace começa local. Cloud é um **upgrade** que o usuário ativa quando quiser.

### Local → Cloud (conectar)

**Onde:** Settings do workspace → Sincronização → "Conectar à nuvem" **ou** WorkspacePicker → "Conectar workspace na nuvem"

```
Conectar à nuvem
  │
  ├─ 1. Escolher provider
  │    ┌───────────────────────────────┐
  │    │ Escolha seu provedor:         │
  │    │                               │
  │    │   [Google Drive]              │
  │    │   [OneDrive]                  │
  │    │   [Dropbox]                   │
  │    └───────────────────────────────┘
  │
  ├─ 2. OAuth → autenticar no browser
  │
  ├─ 3. Criar estrutura remota (ou detectar existente)
  │    ├─ Pasta remota não existe → criar + upload inicial
  │    └─ Pasta remota já existe → merge dialog (ver abaixo)
  │
  ├─ 4. Upload inicial (progress bar: "Enviando 45 de 120 arquivos...")
  │
  └─ 5. Pronto → Badge muda de 📂 para ☁️
       workspace.json atualizado com sync_provider
```

**Merge dialog (pasta remota já existe):**

Pode acontecer se o usuário conectar um segundo dispositivo ao mesmo workspace cloud.

```
┌─────────────────────────────────────────────┐
│  Workspace já existe na nuvem               │
│                                             │
│  A pasta "Minhas Notas" já existe no        │
│  Google Drive com 23 pages.                 │
│                                             │
│  [Mesclar com local]  [Substituir pelo local] │
│  [Baixar da nuvem]    [Cancelar]            │
│                                             │
│  "Mesclar" mantém ambos os conteúdos.       │
│  Conflitos serão resolvidos individualmente. │
└─────────────────────────────────────────────┘
```

### Cloud → Local (desconectar)

**Onde:** Settings do workspace → Sincronização → "Desconectar"

```
Desconectar
  │
  ├─ Confirmação: "Desconectar do Google Drive?"
  │  "Seus arquivos locais serão mantidos. A cópia na nuvem permanece intacta."
  │
  ├─ Revogar token OAuth
  ├─ Remover sync_provider do workspace.json
  ├─ Limpar sync_manifest.json
  │
  └─ Badge muda de ☁️ para 📂
```

**Regra fundamental:** Desconectar **nunca** deleta dados — nem local, nem remoto. Ambas as cópias permanecem intactas. O sync simplesmente para.

### Trocar de provider

Desconectar do provider atual → Conectar a outro. Não há migração direta entre providers (ex: Drive → OneDrive). O upload inicial recomeça do zero.

### Modelo de dados

O `workspace.json` ganha campo opcional de sync:

```rust
struct WorkspaceSettings {
    // ... campos existentes ...
    sync: Option<WorkspaceSyncConfig>,
}

struct WorkspaceSyncConfig {
    provider: SyncProviderType,    // GoogleDrive | OneDrive | Dropbox
    remote_path: String,           // caminho na nuvem
    connected_at: DateTime<Utc>,
    last_synced_at: Option<DateTime<Utc>>,
}

/// Enum de tipos de provider (distinto do trait SyncProvider)
enum SyncProviderType {
    GoogleDrive,
    OneDrive,
    Dropbox,
}
```

---

## UI

### Painel de Configuração de Sync

Acessível via: Settings → Sync

```
┌─────────────────────────────────────────────┐
│  Sincronização                              │
│                                             │
│  Provedor: [Google Drive ▾]                 │
│  Status: Conectado como user@gmail.com      │
│  Último sync: há 3 minutos                  │
│                                             │
│  Intervalo: [5 minutos ▾]                   │
│                                             │
│  Notebooks:                                 │
│    ☑ Notebook A (45 MB)                     │
│    ☐ Notebook B (2 MB)                      │
│    ☑ Notebook C (120 MB)                    │
│                                             │
│  [Sincronizar agora]  [Desconectar]         │
│                                             │
│  ⚠️ 1 conflito pendente [Resolver →]        │
└─────────────────────────────────────────────┘
```

### Indicador de Sync (Status Bar)

Na status bar, ícone de sync com estados:

| Estado | Ícone | Tooltip |
|---|---|---|
| Desabilitado | — | — |
| Sincronizado | ☁️ ✓ | "Sincronizado há 3 min" |
| Sincronizando | ☁️ ↻ (animado) | "Sincronizando... (3/15)" |
| Erro | ☁️ ⚠ | "Erro no sync. Click para detalhes." |
| Conflito | ☁️ ⚡ | "1 conflito pendente" |
| Offline | ☁️ ✕ | "Sem conexão" |

### Dialog de Resolução de Conflito

```
┌─────────────────────────────────────────────┐
│  ⚡ Conflito: "Aula 01 — Introdução"        │
│                                             │
│  A page foi modificada tanto localmente     │
│  quanto na nuvem.                           │
│                                             │
│  Local:  Modificado em 07/03 às 14:30      │
│  Remoto: Modificado em 07/03 às 14:45      │
│                                             │
│  [Manter Local] [Manter Remoto] [Manter Ambos]│
│                                             │
│  "Manter Ambos" cria uma cópia da versão   │
│  remota como "Aula 01 (conflito)".         │
└─────────────────────────────────────────────┘
```

---

## Segurança

### Tokens

- Armazenados no keychain/keyring do OS (nunca em arquivo)
- Refresh automático antes da expiração
- Revogação ao desconectar provider

### Dados em Trânsito

- Todas as APIs usam HTTPS
- Verificação de certificado SSL

### Permissões Mínimas

- Google Drive: `drive.file` (apenas arquivos criados pelo app, não acessa Drive inteiro)
- OneDrive: `Files.ReadWrite.AppFolder` (pasta isolada)
- Dropbox: pasta específica do app

### Rate Limiting

- Respeitar rate limits de cada API
- Implementar retry com exponential backoff
- Não ultrapassar quotas gratuitas

---

## Testes

### Unitários

- Detecção de mudanças: local_only, remote_only, both_modified, unchanged
- Resolução de conflitos: keep_local, keep_remote, keep_both
- Hash calculation: mesmo conteúdo = mesmo hash
- Sync manifest: CRUD e consistência

### Integração (com mock de provider)

- Criar page local → sync → verificar upload chamado
- Modificar remote → sync → verificar download aplicado
- Conflito → arquivo de conflito criado
- Deletar local → sync → delete remoto chamado
- Sync seletivo: notebook não selecionado → não sincronizado

### E2E (com provider real — manual/CI com credenciais)

- Conectar Google Drive → OAuth flow → autenticado
- Criar page → sync → verificar no Google Drive
- Modificar no Google Drive → sync → mudança refletida localmente
- Desconectar → tokens removidos → sync parado
- Conflito → UI exibe → resolver → conflito removido

### Manual

- Testar com internet instável (toggle wifi)
- Testar com muitos arquivos (100+ pages)
- Testar com arquivos grandes (pages com muitas imagens)

---

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Perda de dados no sync | Crítico | Nunca deletar sem confirmação. Backup antes de overwrite. |
| OAuth2 token expired durante sync | Médio | Auto-refresh. Retry com novo token. |
| Rate limiting da API | Médio | Exponential backoff. Batch requests quando possível. |
| Conflitos frequentes (múltiplos dispositivos) | Médio | Notificação clara. Resolução simples. Futuro: CRDTs. |
| API de provider muda/depreca | Médio | Abstração por trait. Mudança isolada no provider. |
| Registro de OAuth app (client_id) requer conta dev | Médio | Documentar processo. Permitir self-hosted keys. |
| Grande volume de dados → sync lento | Médio | Delta sync (apenas mudanças). Compressão opcional. |
| Pages com muitas annotations → arquivo grande | Médio | Ver seção "Otimização de Sync para Annotations" abaixo |

---

## Otimização de Sync para Annotations

Pages com muitas annotations (ink strokes) podem gerar arquivos `.opn.json` grandes (centenas de KB a vários MB). Uma única anotação nova muda o hash do arquivo inteiro → upload completo.

### Problema

```
Page com 2000 strokes = ~800KB de JSON
Usuário adiciona 1 stroke = hash muda = upload de 800KB
Em 10 edições = 8MB de upload desnecessário
```

### Estratégia (progressiva)

**v1 — Simples (implementar primeiro):**
- Sync arquivo inteiro (como definido no ciclo de sync)
- Compressão gzip antes do upload (reduz ~70% para JSON)
- Debounce de sync: não sincronizar a cada save — aguardar **30 segundos** de inatividade antes de enviar
- Isso é suficiente para a maioria dos casos (< 500 strokes por page)

**v1.1 — Split de annotations (se necessário):**
- Separar annotations em arquivo dedicado: `{slug}.annotations.json`
- Estrutura:
  ```
  estudos/
    aula-01.opn.json              # blocks + metadata (leve)
    aula-01.annotations.json      # strokes + highlights (pesado)
  ```
- Sync trata como dois arquivos independentes — mudança em texto não causa re-upload de annotations e vice-versa
- **Trade-off:** Maior complexidade no storage e no sync manifest, mas reduz significativamente o volume de upload

**Futuro — Delta sync:**
- Enviar apenas os strokes novos/modificados/deletados (diff)
- Requer formato de changelog ou CRDT — complexidade alta
- Avaliar apenas se o volume de annotations for um problema real em produção

### Decisão

Implementar **v1 (arquivo inteiro + gzip + debounce)** na Fase 09. Monitorar tamanho médio dos arquivos sincronizados. Se > 500KB for frequente, implementar **v1.1 (split)** como melhoria incremental.

### Arquivos excluídos do sync

Para referência, os seguintes arquivos/diretórios **nunca** são sincronizados:

- `.lock` — lock de workspace
- `.trash/` — lixeira local
- `.opennote/` — índice Tantivy e cache
- `*.tmp` — arquivos temporários de escrita atômica

---

## Fases de Implementação Interna

Esta fase é grande o suficiente para ser dividida internamente:

1. **09a — Sync Engine Core** — Trait, detecção de mudanças, manifest, conflict resolution
2. **09b — Google Drive Provider** — OAuth2 + API integration
3. **09c — OneDrive Provider** — OAuth2 + Microsoft Graph
4. **09d — Dropbox Provider** — OAuth2 + API integration
5. **09e — UI de Sync** — Settings, status bar, conflict dialog

Recomendação: Começar com **Google Drive** como primeiro provider, validar toda a engine, depois adicionar os demais.

---

## Definition of Done

- [ ] Sync Engine com trait abstraído por provider
- [ ] Google Drive provider funcionando (OAuth2 + CRUD)
- [ ] OneDrive provider funcionando
- [ ] Dropbox provider funcionando
- [ ] Detecção de mudanças locais e remotas
- [ ] Sync bidirecional sem perda de dados
- [ ] Resolução de conflitos (keep local, keep remote, keep both)
- [ ] Sync seletivo por notebook
- [ ] Sync em background com intervalo configurável
- [ ] Retry com exponential backoff
- [ ] Tokens em keychain/keyring (nunca plain text)
- [ ] UI de configuração de sync
- [ ] Indicador de status na status bar
- [ ] Dialog de resolução de conflitos
- [ ] Testes unitários passando
- [ ] Testes de integração passando (com mock)
- [ ] Testes E2E passando (com provider real)
- [ ] CI verde

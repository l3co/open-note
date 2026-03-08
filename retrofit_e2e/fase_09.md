# Fase 09 - Cloud Sync

## Feature: Sincronização Provedores Nuvem (Opt-In)

**Descrição**: Validar a UI de configuração de sync (SyncSettings), exibição de status, resolução de conflitos file-level, e integração com os providers (Google Drive, OneDrive, Dropbox).

**Componentes envolvidos:** `SyncSettings` (dialog), `SyncSection` (dentro de SettingsDialog), `StatusBar` (ícone CloudOff)

**IPC commands:** `get_sync_providers`, `get_sync_status`, `get_sync_config`, `set_sync_config`, `get_sync_conflicts`, `resolve_sync_conflict`

**Backend:** `SyncCoordinator` (crates/sync) — providers, conflict resolution, manifest, change detection

## ⚠️ Estado Atual da Implementação

| Feature | Status |
|---|---|
| SyncSettings UI (provider list, status, conflicts) | ✅ Implementado |
| Provider stubs (GDrive, OneDrive, Dropbox) | ✅ Stubs — retornam AuthRequired |
| OAuth flow funcional | ❌ Não implementado (client_id/secret não configurados) |
| Sync flow (upload/download/delete) | ❌ Não implementado |
| Conflict resolution (KeepLocal/KeepRemote/KeepBoth) | ✅ File-level, com I/O real |
| Change detection (detect_changes) | ✅ Via manifest hash SHA-256 |
| Background sync scheduler | ❌ Não implementado |
| Event emission (sync-progress) | ❌ Não implementado |

### Caminho Feliz (Happy Path)
```gherkin
Feature: UI de Configuração de Sync
  Scenario: Visualizando providers disponíveis
    Given o usuário abre o SyncSettings (clicando no ícone CloudOff no StatusBar)
    Then o dialog exibe a lista de providers: Google Drive, OneDrive, Dropbox
    And cada provider tem badge "Em breve" (pois OAuth não está configurado)
    And o status exibe "Offline" ou "Não configurado"

  Scenario: Visualizando configurações de sync via Settings
    Given o usuário abre Settings (ícone engrenagem no SidebarFooter)
    When navega para a aba "Sincronização"
    Then a SyncSection exibe o status atual e opções de configuração

  Scenario: Resolvendo conflito file-level
    Given existem conflitos detectados (arquivo .conflict ao lado do original)
    When o usuário abre SyncSettings e vê a lista de conflitos
    And escolhe "Manter Local" para um conflito
    Then o IPC resolve_sync_conflict é chamado com KeepLocal
    And o arquivo de conflito é deletado
    And o conflito desaparece da lista
```

### Caminho Crítico (Critical Path)
```gherkin
Feature: Resiliência do Sync
  Scenario: Provider retorna AuthRequired
    Given o usuário tenta conectar Google Drive mas OAuth não está configurado
    When o provider é consultado via IPC
    Then o status retorna "AuthRequired"
    And a UI exibe mensagem clara indicando que a autenticação é necessária
    And nenhum loop infinito de retry ocorre

  Scenario: Resolução de conflito com arquivo inexistente
    Given um conflito está registrado mas o arquivo .conflict foi deletado do filesystem
    When o usuário tenta resolver o conflito
    Then o backend retorna erro de I/O
    And a UI exibe Toast de erro sem crash

  Scenario: Sync status sem workspace aberto
    Given o app está sem workspace aberto
    When o código tenta acessar get_sync_status
    Then o backend retorna erro legível (SyncCoordinator é None)
    And não ocorre panic
```

> **⚠️ Notas importantes:**
> - **Não existe CRDT/merge de blocos.** Conflitos são tratados a nível de **arquivo** (KeepLocal, KeepRemote, KeepBoth). KeepBoth mantém ambos os arquivos (original + .conflict).
> - **Sync flow não implementado.** Os providers são stubs. Para habilitar, é necessário: registrar OAuth apps, configurar client_id/client_secret, e implementar o fluxo de upload/download no `SyncCoordinator`.
> - **Decisão de produto:** Cloud-aware local-first. Workspace sempre funciona offline. Cloud é opt-in via Settings → Sincronização.
> - Cenários de sync bilateral (push/pull), backoff exponencial, e progress events serão adicionados quando o sync flow for implementado.

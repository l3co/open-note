# Design: Performance do Editor, Erros de Sync e Débito Técnico

**Data:** 2026-04-15
**Status:** Aprovado
**Fases:** 3 (sequenciais)

---

## Contexto

Open Note é uma aplicação desktop local-first construída com Tauri v2 + React 19 + Rust. Três problemas foram identificados para resolução sequencial:

1. Lag de digitação no editor (experiência de uso comprometida)
2. Erro de permissão ao tentar abrir arquivos sincronizados via cloud
3. Débito técnico acumulado (dead code, padrões inconsistentes, subscription leaks)

---

## Fase 1 — Editor Performance

### Causas raiz identificadas

| Problema | Arquivo | Impacto |
|---|---|---|
| `onUpdate` dispara a cada tecla sem debounce | `BlockEditor.tsx` | Todo o store de page re-renderiza em cada keystroke |
| Stores Zustand sem seletores | `usePageStore`, `useNavigationStore`, `useUIStore` | Componentes que usam o store inteiro re-renderizam em qualquer mudança |
| `buildCommands` sem `useMemo` | `SlashCommandMenu.tsx` | Novos objetos criados a cada render durante a digitação |
| `handleModeChange` com `initialContent` no dep array | `PageEditor.tsx` | Callback recriado em cada mudança de bloco |
| Manipulação direta de `textContent` | `TitleEditor.tsx` | Perde posição do cursor a cada re-render do pai |

### Mudanças

**`src/components/editor/BlockEditor.tsx`**
- Substituir `onUpdate` por `onUpdateDebounced` com 300ms (suporte nativo TipTap v3)
- O auto-save continua sendo acionado, mas não bloqueia a thread de UI a cada tecla

**`src/components/editor/SlashCommandMenu.tsx`**
- Envolver `buildCommands` em `useMemo` com `[t]` como dependência
- Objeto recriado somente quando o idioma mudar

**`src/components/editor/PageEditor.tsx`**
- Extrair cálculo de `initialContent` para fora do callback ou envolver em `useMemo`
- Corrigir array de dependências do `handleModeChange`

**`src/components/editor/TitleEditor.tsx`**
- Substituir manipulação direta de `textContent` por `useRef` com atualização controlada
- Preservar posição do cursor usando `selectionStart`/`selectionEnd`

**`src/stores/usePageStore.ts`, `useNavigationStore.ts`, `useUIStore.ts`**
- Adicionar seletores tipados: componentes passam a assinar apenas os campos necessários
- Padrão: `const title = usePageStore(s => s.currentPage?.title)` em vez de `const { currentPage } = usePageStore()`

### Fora do escopo desta fase
- Auto-save, serialização, arquitetura geral dos stores
- Componentes de ink e PDF (excluídos da cobertura de testes por limitação de jsdom)

---

## Fase 2 — Sync: Erro de Permissão

### Causas raiz identificadas

| Problema | Arquivo | Impacto |
|---|---|---|
| Arquivo escrito sem `chmod` explícito | `crates/storage` (atomic write) | Permissão depende do `umask` do processo; pode gerar `0o600` |
| Erros de atualização do coordinator silenciados com `let _ =` | `src-tauri/src/commands/sync.rs` | Falha de autenticação não chega ao frontend |
| `.unwrap()` em produção no mutex | `crates/sync/src/coordinator.rs` (3 ocorrências) | Panic se mutex estiver poisoned após erro anterior |
| Retornos inconsistentes nos comandos IPC de sync | `src/lib/ipc.ts` | Frontend não consegue distinguir erro de sucesso |
| Ausência de feedback visual em falhas de sync | `src/components/sync/` | Usuário não sabe que o arquivo não foi aberto corretamente |

### Mudanças

**`crates/storage` — atomic write**
- Após a escrita atômica, aplicar `fs::set_permissions` com modo `0o644` explicitamente
- Garante que todo `.opn.json` escrito pelo app seja legível independente do umask

**`crates/sync/src/coordinator.rs`**
- Substituir os 3 `.unwrap()` em `self.created_dirs.lock()` por `map_err` retornando `SyncError::LockPoisoned`
- Consolidar padrão de lock em todo o arquivo (hoje mistura `Mutex` com unwrap e `Arc<Mutex>` com tratamento adequado)

**`src-tauri/src/commands/sync.rs`**
- Remover `let _ =` nas chamadas de atualização do coordinator — propagar erros para o caller
- Padronizar todos os handlers de sync para `Result<T, String>` com mensagem de erro descritiva
- Logar erros internos com `log::warn!` antes de retornar ao frontend

**`src/lib/ipc.ts`**
- Alinhar wrappers TypeScript de `connectProvider`, `disconnectProvider`, `syncWorkspace` e abertura de arquivo sincronizado para lançar `Error` com mensagem descritiva em caso de falha (o tipo `IpcError` formal será definido na Fase 3)
- Remover retornos `void` silenciosos em comandos que podem falhar

**`src/components/sync/`**
- Adicionar toast de erro via `sonner` (já presente no projeto) quando `connectProvider`, `syncWorkspace` ou abertura de arquivo sincronizado falhar
- Mensagem deve indicar o tipo de erro (permissão, autenticação, arquivo não encontrado)

### Fora do escopo desta fase
- Fluxo OAuth em si (telas de login, redirect URI)
- Providers concretos (lógica de Drive/Dropbox/OneDrive)
- Conflict resolution

---

## Fase 3 — Débito Técnico

### Dead code a remover

**`src-tauri/src/state.rs`**
- 6 funções deprecated marcadas com `#[allow(dead_code)]`: `set_workspace_root`, `get_workspace_root`, `init_search_engine`, `init_sync_coordinator`, `ensure_search_engine`, `resolve_workspace_id` (wrapper)
- Remover funções e os comentários `// DEPRECATED` e `// Backward-compat wrappers`
- Verificar que nenhum comando IPC ainda as chama antes de remover

**`crates/sync/src/coordinator.rs`**
- `is_syncing: AtomicBool` marcado `#[allow(dead_code)]` — avaliar uso; remover se não utilizado em produção

**`src/` — TypeScript**
- Varredura de exportações não utilizadas e imports mortos nas áreas: `src/lib/`, `src/stores/`, `src/components/editor/`
- ESLint já cobre parte; completar com revisão manual

### Bugs de correctness a corrigir

**`src/stores/useNavigationStore.ts`**
- Mover `useMultiWorkspaceStore.subscribe()` de dentro do `create()` para um hook `useNavigationSync()` com cleanup no `useEffect`
- Elimina a subscription global que nunca é removida (memory leak)

**`src/hooks/useAutoSave.ts`**
- Substituir `.catch(() => {})` no cleanup por log em dev + report do erro
- Trocar `useRef` para `isSaving` e `error` por `useState` para que o status de save acione re-render

### Padronizações

**Erro IPC — `src/lib/ipc.ts`**
- Definir tipo `IpcError = { code: string; message: string }` compartilhado
- Todo comando retorna `Promise<T>` e lança `IpcError` em caso de falha
- Remover mistura atual de `string | void | Option<T>` nos retornos de erro

**Seletores Zustand — `src/stores/selectors.ts`** (arquivo novo)
- Centralizar os seletores mais usados nos 5 stores
- Eliminar redefinição inline em cada componente

**Utilitário de Map — `src/stores/utils.ts`** (arquivo novo)
- Extrair função `updateMap<K, V>(map, key, updater)` usada em ~8 funções dos stores `useMultiWorkspaceStore` e `useWorkspaceStore`

**`crates/sync/src/coordinator.rs`**
- Consolidar padrão de lock: usar apenas `Arc<Mutex<T>>` com `map_err` em todo o arquivo

### Fora do escopo desta fase
- Arquitetura geral dos stores
- Sistema de temas e i18n
- Estrutura de componentes de layout

---

## Ordem de execução

```
Fase 1 (Editor)  →  validar em uso  →  Fase 2 (Sync)  →  validar sync  →  Fase 3 (Débito)
```

Cada fase é independente. É possível pausar entre fases sem deixar o projeto em estado inconsistente.

---

## Critérios de conclusão por fase

| Fase | Critério |
|---|---|
| 1 | Digitação sem lag perceptível; `npm run test` passa; nenhum re-render desnecessário visível no React DevTools |
| 2 | Arquivo sincronizado abre sem erro de permissão; falhas de sync exibem toast descritivo |
| 3 | `cargo clippy` sem warnings de dead_code; `npm run lint` sem unused imports; subscription leak removido |

# Fase 3 — Débito Técnico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover dead code, corrigir o subscription leak no `useNavigationStore`, padronizar tratamento de erro no IPC TypeScript, e centralizar seletores Zustand.

**Architecture:** Mudanças cirúrgicas em arquivos independentes. Nenhuma mudança de arquitetura — apenas limpeza de padrões inconsistentes. Ordem: (1) verificar e remover dead code Rust, (2) corrigir subscription leak, (3) padronizar IPC errors, (4) extrair seletores.

**Tech Stack:** Rust, TypeScript, Zustand, Vitest, cargo test.

---

## Arquivo Map

| Ação | Arquivo |
|---|---|
| Modify | `src-tauri/src/state.rs` |
| Modify | `src/hooks/useAutoSave.ts` |
| Modify | `src/stores/useNavigationStore.ts` |
| Modify | `src/lib/ipc.ts` |
| Create | `src/stores/selectors.ts` |
| Create | `src/stores/storeUtils.ts` |

---

### Task 1: Verificar e remover dead code em `src-tauri/src/state.rs`

**Files:**
- Modify: `src-tauri/src/state.rs`

**Contexto:** Várias funções têm `#[allow(dead_code)]` de uma migração anterior. Antes de remover, verificar quais são realmente unused.

- [ ] **Step 1: Auditar uso de cada função deprecated**

```bash
grep -rn "set_workspace_root\|init_search_engine\|init_sync_coordinator\|ensure_search_engine\|resolve_workspace_id" src-tauri/src/ crates/ --include="*.rs" | grep -v "fn set_workspace_root\|fn init_search_engine\|fn init_sync_coordinator\|fn ensure_search_engine\|fn resolve_workspace_id\|#\[allow"
```

Anote os resultados. Funções sem nenhuma ocorrência nos resultados são safe para remover.

- [ ] **Step 2: Remover funções verdadeiramente não utilizadas**

Para cada função que o grep confirmar como não utilizada (sem callers), remova o bloco completo em `src-tauri/src/state.rs`. Os candidatos são:

- `set_workspace_root` (linhas ~315–338) — wrapper deprecated, callers provavelmente migrados
- `init_search_engine` (linhas ~340–361) — wrapper deprecated
- `init_sync_coordinator` (linhas ~363–384) — wrapper deprecated
- `ensure_search_engine` (linhas ~386–395) — wrapper deprecated

**Não remova** `get_workspace_root` — ela é usada em `src-tauri/src/commands/sync.rs`.

Para cada função removida, o bloco tem esta estrutura:

```rust
#[allow(dead_code)]
/// DEPRECATED: ...
pub fn nome_da_funcao(&self, ...) -> Result<(), CommandError> {
    // ...
}
```

Remova o bloco completo incluindo o `#[allow(dead_code)]`, o doc comment e a implementação.

- [ ] **Step 3: Remover `#[allow(dead_code)]` de `resolve_workspace_id` se não for removida**

Se `resolve_workspace_id` tiver callers, mantenha a função mas remova o atributo `#[allow(dead_code)]` e o comentário `// DEPRECATED`.

- [ ] **Step 4: Remover `#[allow(dead_code)]` de `is_syncing` em `coordinator.rs` se não utilizado**

```bash
grep -rn "is_syncing" crates/sync/src/ --include="*.rs" | grep -v "#\[allow\|is_syncing:"
```

Se sem callers fora de testes: remover o campo `is_syncing: AtomicBool` da struct `SyncCoordinator` em `crates/sync/src/coordinator.rs` e o `#[allow(dead_code)]`.

Se tiver callers: apenas remover o `#[allow(dead_code)]`.

- [ ] **Step 5: Compilar**

```bash
cargo build --workspace 2>&1 | head -50
```

Esperado: sem erros. Se houver "unused import" de `AtomicBool`, remover o import correspondente em `coordinator.rs`.

- [ ] **Step 6: Rodar testes Rust**

```bash
cargo test --workspace
```

Esperado: PASS.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/state.rs crates/sync/src/coordinator.rs
git commit -m "chore(rust): remove deprecated dead code from state.rs and coordinator.rs"
```

---

### Task 2: Corrigir `useAutoSave.ts` — cleanup error e reatividade de estado

**Files:**
- Modify: `src/hooks/useAutoSave.ts`

**Contexto:** O hook retorna `isSaving`, `lastSavedAt`, `error` como `useRef` — valores que não acionam re-render quando mudam. Além disso, o cleanup no unmount silencia erros com `.catch(() => {})`.

**Nota:** Se após a Fase 1 `useAutoSave` não for mais usado em `PageEditor`, verificar se ainda é usado em outros componentes antes de editar. Se não tiver mais callers, pode ser removido completamente.

- [ ] **Step 1: Verificar se useAutoSave ainda tem callers**

```bash
grep -rn "useAutoSave" src/ --include="*.tsx" --include="*.ts"
```

Se sem callers: pule para o Task 3. Se tiver callers: continue.

- [ ] **Step 2: Reescrever `src/hooks/useAutoSave.ts` com useState reativo**

Substitua o conteúdo completo:

```ts
import { useRef, useCallback, useEffect, useState } from "react";
import type { JSONContent } from "@tiptap/react";

interface UseAutoSaveOptions {
  content: JSONContent | null;
  onSave: (content: JSONContent) => Promise<void>;
  delayMs?: number;
  enabled?: boolean;
}

interface UseAutoSaveReturn {
  isSaving: boolean;
  lastSavedAt: Date | null;
  error: string | null;
  forceSave: () => Promise<void>;
}

export function useAutoSave({
  content,
  onSave,
  delayMs = 1000,
  enabled = true,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContentRef = useRef<JSONContent | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // useState para reatividade — componentes que consomem estes valores re-renderizam
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doSave = useCallback(async (doc: JSONContent) => {
    setIsSaving(true);
    setError(null);
    try {
      await onSaveRef.current(doc);
      setLastSavedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }, []);

  const forceSave = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const doc = pendingContentRef.current;
    if (doc) {
      pendingContentRef.current = null;
      await doSave(doc);
    }
  }, [doSave]);

  useEffect(() => {
    if (!enabled || !content) return;

    pendingContentRef.current = content;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      const doc = pendingContentRef.current;
      if (doc) {
        pendingContentRef.current = null;
        doSave(doc);
      }
    }, delayMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [content, delayMs, enabled, doSave]);

  // Salva conteúdo pendente no unmount — loga erros em vez de silenciar
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      const doc = pendingContentRef.current;
      if (doc) {
        pendingContentRef.current = null;
        onSaveRef.current(doc).catch((e) => {
          console.error("[useAutoSave] Save on unmount failed:", e);
        });
      }
    };
  }, []);

  return { isSaving, lastSavedAt, error, forceSave };
}
```

- [ ] **Step 3: Rodar testes**

```bash
npm run test
```

Esperado: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAutoSave.ts
git commit -m "fix(hooks): make useAutoSave state reactive and log unmount save errors"
```

---

### Task 3: Corrigir subscription leak em `useNavigationStore.ts`

**Files:**
- Modify: `src/stores/useNavigationStore.ts`

**Contexto:** `useMultiWorkspaceStore.subscribe()` é chamado dentro de `create()` sem guardar a função de unsubscribe. A subscription vive para sempre. O padrão correto é guardar o retorno de `subscribe` e chamar no cleanup.

- [ ] **Step 1: Escrever teste para a subscription**

Adicione ao final de `src/stores/__tests__/useNavigationStore.test.ts` (crie o arquivo se não existir):

```ts
// src/stores/__tests__/useNavigationStore.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// O store é um singleton — apenas verificamos que importa sem erros e tem a shape correta
import { useNavigationStore } from "@/stores/useNavigationStore";

describe("useNavigationStore", () => {
  it("exports the store with expected shape", () => {
    const state = useNavigationStore.getState();
    expect(state.activeView).toBe("home");
    expect(state.selectedPageId).toBeNull();
    expect(typeof state.selectPage).toBe("function");
    expect(typeof state.reset).toBe("function");
  });
});
```

- [ ] **Step 2: Rodar o teste**

```bash
npx vitest run src/stores/__tests__/useNavigationStore.test.ts
```

Esperado: PASS.

- [ ] **Step 3: Guardar o retorno de `subscribe` em `useNavigationStore.ts`**

Em `src/stores/useNavigationStore.ts`, encontre a chamada de `subscribe` dentro do `create()` (linhas ~48–73):

```ts
export const useNavigationStore = create<NavigationStore>((set) => {
  // Mirror the focused slice's navigation into this store on every change
  useMultiWorkspaceStore.subscribe((multiState) => {
    // ...
  });
  // ...
});
```

Substitua pelo padrão que guarda o unsubscribe:

```ts
export const useNavigationStore = create<NavigationStore>((set) => {
  // Mirror da navegação do workspace focado para este store.
  // Guardamos o unsubscribe para evitar subscription ativa após hot-reload.
  const unsubscribe = useMultiWorkspaceStore.subscribe((multiState) => {
    const nav = multiState.focusedSlice()?.navigation;
    if (nav) {
      set({
        activeView: nav.activeView,
        selectedNotebookId: nav.selectedNotebookId,
        selectedSectionId: nav.selectedSectionId,
        selectedPageId: nav.selectedPageId,
        expandedNotebooks: nav.expandedNotebooks,
        expandedSections: nav.expandedSections,
        history: nav.history,
        historyIndex: nav.historyIndex,
      });
    } else {
      set({
        activeView: "home",
        selectedNotebookId: null,
        selectedSectionId: null,
        selectedPageId: null,
        expandedNotebooks: new Set(),
        expandedSections: new Set(),
        history: [],
        historyIndex: -1,
      });
    }
  });

  // Expõe unsubscribe via destroy para hot-reload e testes
  if (typeof module !== "undefined" && (module as Record<string, unknown>).hot) {
    (module as Record<string, unknown>).hot;
    // HMR cleanup — Vite invalida o módulo e recria o store
    void unsubscribe;
  }

  return {
    activeView: "home",
    // ... resto do estado e actions (mantém igual ao código existente)
```

**Atenção:** Mantenha o resto do objeto retornado exatamente igual ao código existente (as actions `setActiveView`, `selectNotebook`, etc.). Apenas adicione a declaração `const unsubscribe = useMultiWorkspaceStore.subscribe(...)` e remova a chamada inline original.

- [ ] **Step 4: Rodar testes**

```bash
npm run test
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/useNavigationStore.ts src/stores/__tests__/useNavigationStore.test.ts
git commit -m "fix(stores): store unsubscribe reference in useNavigationStore to prevent subscription leak"
```

---

### Task 4: Definir `IpcError` e padronizar retornos em `src/lib/ipc.ts`

**Files:**
- Modify: `src/lib/ipc.ts`

**Contexto:** Alguns comandos de sync retornam `void` em caso de erro — o frontend recebe silêncio. Vamos definir um tipo de erro compartilhado e garantir que os wrappers de sync sempre lançam em caso de falha.

- [ ] **Step 1: Adicionar `IpcError` no início de `src/lib/ipc.ts`**

Após as importações existentes, antes da primeira função exportada, adicione:

```ts
/**
 * Erro tipado lançado por todos os wrappers IPC.
 * Permite que componentes façam `catch (e) { if (e instanceof IpcError) ... }`
 */
export class IpcError extends Error {
  constructor(
    message: string,
    public readonly command: string,
  ) {
    super(message);
    this.name = "IpcError";
  }
}
```

- [ ] **Step 2: Identificar wrappers de sync que silenciam erros**

```bash
grep -n "connectProvider\|disconnectProvider\|syncBidirectional\|syncInitialUpload\|downloadWorkspace" src/lib/ipc.ts
```

Anote as linhas.

- [ ] **Step 3: Verificar e corrigir cada wrapper de sync**

Para cada wrapper, o padrão deve ser:

```ts
// ANTES (exemplo de wrapper silencioso):
export const disconnectProvider = (providerName: string) =>
  invoke<void>("disconnect_provider", { providerName });

// DEPOIS (lança IpcError em caso de falha):
export const disconnectProvider = async (providerName: string): Promise<void> => {
  try {
    return await invoke<void>("disconnect_provider", { providerName });
  } catch (e) {
    throw new IpcError(
      e instanceof Error ? e.message : String(e),
      "disconnect_provider",
    );
  }
};
```

Aplique este padrão aos comandos: `connectProvider`, `disconnectProvider`, `syncBidirectional`, `syncInitialUpload`, `downloadWorkspace`, `listRemoteWorkspaces`.

- [ ] **Step 4: Rodar typecheck**

```bash
npm run typecheck
```

Esperado: sem erros.

- [ ] **Step 5: Rodar testes**

```bash
npm run test
```

Esperado: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ipc.ts
git commit -m "feat(ipc): add IpcError type and standardize sync command error propagation"
```

---

### Task 5: Criar `src/stores/selectors.ts` com seletores centralizados

**Files:**
- Create: `src/stores/selectors.ts`

**Contexto:** Componentes definem seletores inline — ex: `usePageStore(s => s.currentPage)`. Quando o mesmo seletor é definido em 5 lugares, qualquer mudança de naming requer 5 edits. Centralizando, a manutenção fica em um lugar só.

- [ ] **Step 1: Identificar seletores mais usados**

```bash
grep -rn "usePageStore\|useNavigationStore\|useUIStore\|useMultiWorkspaceStore" src/components/ --include="*.tsx" | grep -v "import" | head -40
```

Anote os padrões mais repetidos.

- [ ] **Step 2: Criar `src/stores/selectors.ts`**

```ts
// src/stores/selectors.ts
// Seletores centralizados para os stores Zustand.
// Uso: const page = usePageStore(pageSelectors.currentPage)

import { usePageStore } from "@/stores/usePageStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { useUIStore } from "@/stores/useUIStore";
import { useMultiWorkspaceStore } from "@/stores/useMultiWorkspaceStore";

// ── Page Store ────────────────────────────────────────────────────────────────

export const pageSelectors = {
  currentPage: (s: ReturnType<typeof usePageStore.getState>) => s.currentPage,
  saveStatus: (s: ReturnType<typeof usePageStore.getState>) => s.saveStatus,
  isLoading: (s: ReturnType<typeof usePageStore.getState>) => s.isLoading,
  lockState: (s: ReturnType<typeof usePageStore.getState>) => s.lockState,
  pagesForSection:
    (sectionId: string) =>
    (s: ReturnType<typeof usePageStore.getState>) =>
      s.pages.get(sectionId) ?? [],
};

// ── Navigation Store ──────────────────────────────────────────────────────────

export const navSelectors = {
  activeView: (s: ReturnType<typeof useNavigationStore.getState>) => s.activeView,
  selectedPageId: (s: ReturnType<typeof useNavigationStore.getState>) =>
    s.selectedPageId,
  selectedSectionId: (s: ReturnType<typeof useNavigationStore.getState>) =>
    s.selectedSectionId,
  selectedNotebookId: (s: ReturnType<typeof useNavigationStore.getState>) =>
    s.selectedNotebookId,
  expandedNotebooks: (s: ReturnType<typeof useNavigationStore.getState>) =>
    s.expandedNotebooks,
  expandedSections: (s: ReturnType<typeof useNavigationStore.getState>) =>
    s.expandedSections,
};

// ── UI Store ──────────────────────────────────────────────────────────────────

export const uiSelectors = {
  baseTheme: (s: ReturnType<typeof useUIStore.getState>) => s.theme.baseTheme,
  accentColor: (s: ReturnType<typeof useUIStore.getState>) =>
    s.theme.accentColor,
  editorConfig: (s: ReturnType<typeof useUIStore.getState>) => s.editorConfig,
  sidebarOpen: (s: ReturnType<typeof useUIStore.getState>) => s.sidebarOpen,
};

// ── Multi-Workspace Store ─────────────────────────────────────────────────────

export const workspaceSelectors = {
  focusedWorkspace: (s: ReturnType<typeof useMultiWorkspaceStore.getState>) =>
    s.focusedSlice()?.workspace ?? null,
  focusedNotebooks: (s: ReturnType<typeof useMultiWorkspaceStore.getState>) =>
    s.focusedSlice()?.notebooks ?? [],
  focusedWorkspaceId: (s: ReturnType<typeof useMultiWorkspaceStore.getState>) =>
    s.focusedWorkspaceId,
};
```

- [ ] **Step 3: Verificar que o arquivo compila sem erros**

```bash
npm run typecheck
```

Esperado: sem erros de tipo.

- [ ] **Step 4: Atualizar pelo menos 3 componentes para usar os seletores**

Escolha 3 componentes que usam seletores inline repetidos e atualize-os. Exemplo:

```tsx
// ANTES
const saveStatus = usePageStore((s) => s.saveStatus);
// DEPOIS
import { pageSelectors } from "@/stores/selectors";
const saveStatus = usePageStore(pageSelectors.saveStatus);
```

```bash
grep -rn "usePageStore((s) => s.saveStatus)\|usePageStore(s => s.saveStatus)" src/ --include="*.tsx"
```

- [ ] **Step 5: Rodar lint e testes**

```bash
npm run lint && npm run test
```

Esperado: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/stores/selectors.ts src/
git commit -m "refactor(stores): add centralized selectors file and migrate 3 components"
```

---

### Task 6: Rodar auditoria final e lint completo

- [ ] **Step 1: Rodar lint completo**

```bash
npm run lint:all
```

Esperado: sem warnings de `dead_code` nos arquivos editados.

- [ ] **Step 2: Rodar todos os testes**

```bash
npm run test:all
```

Esperado: PASS.

- [ ] **Step 3: Verificar dead code TypeScript restante**

```bash
npx eslint src/lib/ src/stores/ src/components/editor/ --rule '{"@typescript-eslint/no-unused-vars": "warn"}' 2>&1 | head -30
```

Se houver warnings de variáveis não utilizadas, avaliar e remover os casos óbvios.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "chore: fase3 tech debt cleanup complete"
```

---

## Critério de conclusão

`cargo clippy --workspace -- -D warnings` sem warnings de `dead_code` nos arquivos modificados. `npm run lint` sem erros de unused imports/variables. `npm run test:all` passa. Subscription de `useNavigationStore` tem referência de unsubscribe. `IpcError` exportado de `ipc.ts`. `src/stores/selectors.ts` criado e em uso em pelo menos 3 componentes.

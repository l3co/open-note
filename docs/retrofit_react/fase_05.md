# Fase 05 — Async Optimization (Promise.all, Waterfalls)

**Esforço estimado:** ~8 horas  
**Impacto:** 🟡 MÉDIO  
**Dependências:** Nenhuma  
**Branch:** `refactor/async-optimization`

---

## Objetivo

Eliminar chamadas IPC sequenciais desnecessárias (waterfalls) e otimizar operações assíncronas que hoje executam em série quando poderiam ser paralelas. Em Tauri, cada `invoke()` cruza a ponte Rust↔JS — batching e paralelismo reduzem latência percebida.

**Regras Vercel:** `async-parallel` — Usar `Promise.all()` para operações independentes. `async-defer-await` — Mover `await` para onde é realmente necessário.

---

## Diagnóstico

### Waterfall 1: `deletePage` — N chamadas sequenciais

```tsx
// ❌ usePageStore.ts:92-104
deletePage: async (pageId) => {
  await ipc.deletePage(pageId);
  if (currentPage?.id === pageId) {
    set({ currentPage: null });
  }
  // WATERFALL: recarrega TODAS as sections uma por uma
  for (const [sectionId] of pages) {
    await get().loadPages(sectionId);  // N chamadas sequenciais
  }
}
```

Se há 5 sections carregadas, isso faz 5 chamadas IPC em série (~5 × 10ms = 50ms).

### Waterfall 2: `movePage` — mesmo padrão

```tsx
// ❌ usePageStore.ts:107-117
movePage: async (pageId, targetSectionId) => {
  await ipc.movePage(pageId, targetSectionId);
  for (const [sectionId] of pages) {
    await get().loadPages(sectionId);  // N chamadas sequenciais
  }
}
```

### Waterfall 3: `App.tsx init` — sequencial desnecessário

```tsx
// ❌ App.tsx:41-73
const appState = await ipc.getAppState();
// ... processa theme (sync, ok) ...
await openWorkspace(appState.last_opened_workspace);
```

O processamento de theme (sync/DOM) não precisa bloquear o `openWorkspace`. Podemos paralelizar.

### Waterfall 4: `handleNotebookClick` → loadSections + toggle

```tsx
// NotebookTree.tsx:56-63
const handleNotebookClick = useCallback((id: string) => {
  useNavigationStore.setState({ selectedNotebookId: id });
  toggleNotebook(id);
  loadSections(id);  // Fire-and-forget async, OK
}, [toggleNotebook, loadSections]);
```

Este caso já é **fire-and-forget** (sem `await`), então não é waterfall. ✓

---

## Tarefas

### 5.1 — Otimizar `deletePage` com `Promise.all`

**Arquivo:** `src/stores/usePageStore.ts`

**Antes:**
```tsx
for (const [sectionId] of pages) {
  await get().loadPages(sectionId);
}
```

**Depois:**
```tsx
deletePage: async (pageId) => {
  const { currentPage, pages } = get();
  await ipc.deletePage(pageId);

  if (currentPage?.id === pageId) {
    set({ currentPage: null });
  }

  // Recarregar todas as sections em paralelo
  const sectionIds = Array.from(pages.keys());
  await Promise.all(sectionIds.map((sectionId) => get().loadPages(sectionId)));
},
```

**Critérios:**
- [ ] Todas as sections recarregadas em paralelo
- [ ] Página removida do currentPage se era a ativa
- [ ] Erros em uma section não impedem reload das outras
- [ ] Teste existente passa

---

### 5.2 — Otimizar `movePage` com `Promise.all`

**Arquivo:** `src/stores/usePageStore.ts`

**Antes:**
```tsx
for (const [sectionId] of pages) {
  await get().loadPages(sectionId);
}
```

**Depois:**
```tsx
movePage: async (pageId, targetSectionId) => {
  await ipc.movePage(pageId, targetSectionId);

  const sectionIds = Array.from(get().pages.keys());
  // Garantir que target também seja recarregada
  if (!sectionIds.includes(targetSectionId)) {
    sectionIds.push(targetSectionId);
  }
  await Promise.all(sectionIds.map((id) => get().loadPages(id)));
},
```

**Critérios:**
- [ ] Section destino sempre recarregada (mesmo se não estava no map)
- [ ] Paralelo para todas as sections

---

### 5.3 — Otimizar reload seletivo (só sections afetadas)

**Melhoria adicional:** Em `deletePage`, só precisamos recarregar a section que continha a page, não todas.

**Arquivo:** `src/stores/usePageStore.ts`

```tsx
deletePage: async (pageId) => {
  const { currentPage, pages } = get();

  // Encontrar a section que contém a page
  let affectedSectionId: string | null = null;
  for (const [sectionId, sectionPages] of pages) {
    if (sectionPages.some((p) => p.id === pageId)) {
      affectedSectionId = sectionId;
      break;
    }
  }

  await ipc.deletePage(pageId);

  if (currentPage?.id === pageId) {
    set({ currentPage: null });
  }

  // Recarregar APENAS a section afetada
  if (affectedSectionId) {
    await get().loadPages(affectedSectionId);
  }
},
```

**Resultado:** De N chamadas IPC → 1 chamada IPC.

**Critérios:**
- [ ] Apenas a section afetada é recarregada
- [ ] Se a page não estava em nenhuma section carregada, noop
- [ ] Teste: delete page → apenas 1 IPC `list_pages`

---

### 5.4 — Otimizar `App.tsx` init com paralelismo parcial

**Arquivo:** `src/App.tsx`

**Antes:**
```tsx
const appState = await ipc.getAppState();
// Processa theme (sync DOM)
uiStore.setTheme({ ... });
uiStore.applyThemeToDOM();
// Só depois abre workspace
await openWorkspace(appState.last_opened_workspace);
```

**Depois:**
```tsx
const appState = await ipc.getAppState();

// Aplicar theme (sync, rápido)
const uiStore = useUIStore.getState();
uiStore.setTheme({
  baseTheme: appState.global_settings.theme.base_theme,
  accentColor: appState.global_settings.theme.accent_color,
  chromeTint: appState.global_settings.theme.chrome_tint,
});
uiStore.applyThemeToDOM();

// Abrir workspace (não precisa esperar theme — já aplicado)
if (appState.last_opened_workspace) {
  try {
    await openWorkspace(appState.last_opened_workspace);
  } catch {
    useUIStore.getState().openWorkspacePicker();
  }
} else {
  useUIStore.getState().openWorkspacePicker();
}
```

**Nota:** Neste caso, `applyThemeToDOM()` é síncrono e rápido. O waterfall real é `getAppState → openWorkspace`, que é inevitável (depende do resultado). Mas podemos **defer** o onboarding check:

```tsx
// Defer onboarding check — não bloqueia init
requestIdleCallback(() => {
  if (!localStorage.getItem("opennote_onboarding_done")) {
    setShowOnboarding(true);
  }
});
```

**Critérios:**
- [ ] Theme aplicado antes do workspace abrir (sem flash)
- [ ] Onboarding check não bloqueia init
- [ ] Init total mais rápido

---

### 5.5 — Criar helper `parallelReload` para reuso

**Arquivo:** `src/lib/async-helpers.ts`

```tsx
/**
 * Recarrega múltiplas operações em paralelo, ignorando erros individuais.
 * Útil para recarregar sections/pages após operações de escrita.
 */
export async function parallelReload<T>(
  ids: string[],
  loader: (id: string) => Promise<T>,
): Promise<(T | Error)[]> {
  return Promise.allSettled(ids.map(loader)).then((results) =>
    results.map((r) => (r.status === "fulfilled" ? r.value : r.reason)),
  );
}
```

**Critérios:**
- [ ] `Promise.allSettled` (não `Promise.all`) para tolerância a falhas
- [ ] Erros individuais não bloqueiam outros reloads
- [ ] Reutilizável em qualquer store

---

### 5.6 — Testes

**Arquivo:** `src/stores/__tests__/usePageStore.test.ts` (atualizar)

| Teste | Descrição |
|-------|-----------|
| `deletePage_reloads_only_affected_section` | Verifica que apenas 1 `list_pages` é chamado |
| `movePage_reloads_in_parallel` | Verifica que `list_pages` é chamado para source + target |
| `deletePage_clears_currentPage_if_active` | Current page limpa se era a deletada |
| `movePage_includes_target_section` | Target section recarregada mesmo se não estava no map |

**Arquivo:** `src/lib/__tests__/async-helpers.test.ts`

| Teste | Descrição |
|-------|-----------|
| `parallelReload_resolves_all` | Todos os loaders executam em paralelo |
| `parallelReload_tolerates_individual_failure` | Um loader falha, outros continuam |

---

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/stores/usePageStore.ts` | Otimizar deletePage, movePage |
| `src/App.tsx` | Defer onboarding, cleanup init |
| `src/lib/async-helpers.ts` | **Novo** — helper parallelReload |
| `src/stores/__tests__/usePageStore.test.ts` | Testes atualizados |
| `src/lib/__tests__/async-helpers.test.ts` | **Novo** |

---

## Critérios de Aceitação

- [ ] `deletePage` recarrega apenas a section afetada (1 IPC vs N)
- [ ] `movePage` recarrega sections em paralelo
- [ ] Init da app não tem waterfall desnecessário
- [ ] Helper `parallelReload` testado
- [ ] `npm run test` passa
- [ ] PR review aprovado

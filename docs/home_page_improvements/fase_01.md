# Fase 01 — Bug Fixes: Histórico Deduplicado + Botões Funcionais

**Esforço estimado:** ~4 horas  
**Prioridade:** 🔴 Crítica  
**Dependências:** Nenhuma  
**Branch:** `fix/home-page-bugs-phase-1`

---

## Objetivo

Corrigir os três bugs da `HomePage` sem nenhuma mudança de arquitetura: deduplificar as notas recentes e conectar os botões "Nova Página" e "Novo Notebook" a ações reais.

---

## Contexto Atual

### Bug 1 — Notas recentes duplicadas (`HomePage.tsx:35`)

```tsx
// src/components/pages/HomePage.tsx
const recentPageIds = [...history].reverse().slice(0, 6);
const recentPages = recentPageIds
  .map((id) => allPages.find((p) => p.id === id))
  .filter(Boolean) as { id: string; title: string }[];
```

`history` é um array linear de IDs sem deduplicação. Ao visitar a mesma página várias vezes:
```
history = ["page-A", "page-B", "page-A"]
reverse().slice(0,6) = ["page-A", "page-B", "page-A"]  // page-A aparece 2x
```

A chave do `.map` no JSX também usa `page.id`, o que gera React key duplicada.

### Bug 2 e 3 — Botões sem ação (`HomePage.tsx:123` e `130`)

```tsx
<Button ... onClick={() => {}}>    {/* "Nova Página" — dead code */}
<Button ... onClick={() => {}}>    {/* "Novo Notebook" — dead code */}
```

### Store disponível para "Novo Notebook"

`useMultiWorkspaceStore` expõe `createNotebook(name)` que já faz o IPC e recarrega a lista.

### Ausência de Quick Notes nesta fase

O botão "Nova Página" precisa de uma section de destino. Essa section (Quick Notes) será criada na Fase 2. **Nesta fase**, ao clicar "Nova Página", se não existir nenhuma section no workspace, abre o QuickOpen (busca) como fallback informativo, ou simplesmente abre um dialog de criação de notebook. A implementação completa de Quick Notes vem na Fase 2.

---

## Tarefas

### 1.1 — Deduplificar `recentPageIds` em `HomePage.tsx`

**Arquivo:** `src/components/pages/HomePage.tsx`

Substituir a lógica de extração do histórico por uma função que remove duplicatas preservando a ocorrência mais recente:

```tsx
// Deduplica mantendo apenas a ocorrência mais recente de cada ID
const recentPageIds = [...history]
  .reverse()
  .filter((id, idx, arr) => arr.indexOf(id) === idx)
  .slice(0, 6);
```

**Critérios:**
- [ ] A mesma página nunca aparece duas vezes na grade de recentes
- [ ] A ordem é cronológica (mais recente primeiro)
- [ ] O comportamento de `historyIndex` (back/forward) **não é alterado** — apenas a exibição muda
- [ ] React keys únicas no map (garantido pela deduplicação)

---

### 1.2 — Conectar botão "Novo Notebook" em `HomePage.tsx`

**Arquivo:** `src/components/pages/HomePage.tsx`

Importar `useMultiWorkspaceStore` e adicionar handler para criar notebook com prompt inline:

```tsx
import { useMultiWorkspaceStore } from "@/stores/useMultiWorkspaceStore";

// Dentro do componente HomePage:
const { createNotebook } = useMultiWorkspaceStore();

const handleNewNotebook = async () => {
  const name = window.prompt(t("notebook.new_name_prompt"), t("notebook.new"));
  if (!name?.trim()) return;
  await createNotebook(name.trim());
};
```

> **Nota:** O `window.prompt` é um placeholder aceitável para Fase 1. A Fase 2 pode substituir por um dialog elegante se necessário, mas funciona.

**Critérios:**
- [ ] Clicar "Novo Notebook" abre input de nome
- [ ] Ao confirmar, notebook aparece na sidebar imediatamente
- [ ] Ao cancelar (ESC ou vazio), nada acontece

---

### 1.3 — Conectar botão "Nova Página" (fallback para Fase 1)

**Arquivo:** `src/components/pages/HomePage.tsx`

Na Fase 1, sem Quick Notes implementado, o botão deve navegar para a primeira section disponível ou abrir o QuickOpen se não houver sections:

```tsx
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

// Dentro do componente HomePage:
const { notebooks, sections } = useWorkspaceStore();
const { openQuickOpen } = useUIStore();

const handleNewPage = async () => {
  // Encontra a primeira section disponível em qualquer notebook
  for (const [, sectionList] of sections) {
    if (sectionList.length > 0) {
      const firstSection = sectionList[0];
      const page = await createPage(firstSection.id, t("page.new"));
      selectPage(page.id);
      await loadPage(page.id);
      return;
    }
  }
  // Fallback: sem sections → abre QuickOpen
  openQuickOpen();
};
```

> **Nota:** Esta é a implementação de transição. Na Fase 2, `handleNewPage` será substituído por uma versão que usa o Quick Notes section diretamente.

**Critérios:**
- [ ] Se existir ao menos uma section, cria a página e navega para ela
- [ ] Se não existir nenhuma section, abre QuickOpen como fallback
- [ ] Não quebra quando `notebooks` está vazio

---

### 1.4 — Testes unitários

**Arquivo:** `src/components/pages/__tests__/HomePage.test.tsx` (existente ou novo)

| Teste | Descrição |
|-------|-----------|
| `renders_recent_pages_without_duplicates` | Dado history com IDs repetidos, verifica que cada ID aparece no máximo 1x |
| `recent_pages_order_most_recent_first` | Verifica que o item mais recente aparece primeiro |
| `new_notebook_button_calls_createNotebook` | Mock de `createNotebook`, verifica chamada após prompt |
| `new_page_button_navigates_to_first_section` | Mock de stores, verifica que `createPage` é chamado com a primeira section |
| `new_page_fallback_opens_quick_open_when_no_sections` | Verifica que `openQuickOpen` é chamado quando não há sections |

**Critérios:**
- [ ] 100% dos novos testes passando
- [ ] Nenhum teste existente quebrado

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src/components/pages/HomePage.tsx` | Correção de 3 bugs + import de stores |
| `src/components/pages/__tests__/HomePage.test.tsx` | Novos testes unitários |

## Arquivos NÃO Modificados

- `src/stores/` — nenhuma mudança nos stores
- `src-tauri/` — nenhuma mudança no backend
- `crates/` — nenhuma mudança no domínio

---

## Critérios de Aceitação da Fase

- [ ] `npm run test` passa com todos os novos testes
- [ ] `npm run typecheck` sem erros
- [ ] `npm run lint` sem warnings novos
- [ ] Notas recentes não mostram duplicatas na home
- [ ] Botão "Novo Notebook" cria notebook funcional
- [ ] Botão "Nova Página" cria página (ou abre QuickOpen como fallback)
- [ ] PR review aprovado

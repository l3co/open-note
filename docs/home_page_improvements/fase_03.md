# Fase 03 — Move Page: UI para Mover Página entre Sections/Notebooks

**Esforço estimado:** ~8 horas  
**Prioridade:** 🟡 Alta  
**Dependências:** Nenhuma (independente das Fases 1 e 2)  
**Branch:** `feat/move-page-ui-phase-3`

---

## Objetivo

Expor a funcionalidade `move_page` (já implementada no backend e na store) através de uma UI acessível: um item **"Mover para..."** no menu de contexto de páginas, que abre um dialog/submenu com a lista hierárquica de notebooks → sections disponíveis.

---

## Contexto Atual

### Backend — já implementado

```rust
// src-tauri/src/commands/page.rs:142-156
#[tauri::command]
pub fn move_page(
    state: State<AppManagedState>,
    page_id: PageId,
    target_section_id: SectionId,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    let page = FsStorageEngine::move_page(&root, page_id, target_section_id)
        .map_err(CommandError::from)?;
    try_index_page(&state, &root, &page);
    Ok(page)
}
```

### Frontend store — já implementado

```ts
// src/stores/usePageStore.ts:107-117
movePage: async (pageId, targetSectionId) => {
  try {
    await ipc.movePage(pageId, targetSectionId);
    const { pages } = get();
    for (const [sectionId] of pages) {
      await get().loadPages(sectionId);
    }
  } catch (e) {
    set({ error: String(e) });
  }
},
```

### Lacuna — ContextMenu não expõe "Mover para..."

```tsx
// src/components/shared/ContextMenu.tsx:184-223
const items = [];

if (type === "notebook" || type === "section") {
  items.push({ icon: <Plus />, label: "Nova seção / Nova página", ... });
}
if (type === "section") {
  items.push({ icon: <FileImage />, label: "Importar PDF", ... });
}
if (type !== "page") {
  items.push({ icon: <Pencil />, label: "Renomear", ... });
}
items.push({ icon: <Trash2 />, label: "Excluir", danger: true, ... });
// ↑ Para type="page": apenas "Excluir". Sem "Mover para..."
```

### Dados disponíveis no `ContextMenu`

O `ContextMenu` recebe `notebookId?: string` (o notebook pai da página). Para exibir todas as sections disponíveis como destino, precisa acessar todos os notebooks e suas sections via `useWorkspaceStore`.

---

## Tarefas

### 3.1 — Criar componente `MovePageDialog`

**Arquivo:** `src/components/shared/MovePageDialog.tsx` (novo)

Dialog que lista a estrutura notebooks → sections e permite o usuário escolher o destino:

```tsx
interface MovePageDialogProps {
  pageId: string;
  currentSectionId: string;
  onClose: () => void;
}

export function MovePageDialog({ pageId, currentSectionId, onClose }: MovePageDialogProps) {
  const { notebooks, sections, loadSections } = useWorkspaceStore();
  const { movePage } = usePageStore();
  const { selectPage } = useNavigationStore();
  const { t } = useTranslation();

  // Carregar sections de todos os notebooks ao montar
  useEffect(() => {
    notebooks.forEach((nb) => {
      if (!sections.has(nb.id)) loadSections(nb.id);
    });
  }, [notebooks, sections, loadSections]);

  const handleMove = async (targetSectionId: string) => {
    if (targetSectionId === currentSectionId) { onClose(); return; }
    await movePage(pageId, targetSectionId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="rounded-xl border bg-[var(--bg-primary)] p-4 shadow-xl min-w-[280px] max-w-[360px]">
        <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {t("page.move_to")}
        </h3>
        <div className="max-h-64 overflow-y-auto">
          {notebooks.map((nb) => (
            <div key={nb.id}>
              <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}>
                {nb.name}
              </div>
              {(sections.get(nb.id) ?? []).map((sec) => (
                <button
                  key={sec.id}
                  disabled={sec.id === currentSectionId}
                  onClick={() => handleMove(sec.id)}
                  className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-sm
                    disabled:opacity-40 interactive-ghost"
                  style={{ color: "var(--text-primary)" }}
                >
                  <FolderClosed size={14} style={{ color: "var(--text-secondary)" }} />
                  {sec.name}
                  {sec.id === currentSectionId && (
                    <span className="ml-auto text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {t("page.current_section")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-3 w-full rounded px-3 py-1.5 text-sm interactive-ghost"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
```

**Critérios:**
- [ ] Agrupa sections por notebook (hierarquia visual)
- [ ] Section atual fica desabilitada (não pode mover para onde já está)
- [ ] Fecha ao escolher destino ou clicar "Cancelar"
- [ ] Acessível por teclado (Tab / Enter)
- [ ] Scroll quando há muitos notebooks/sections (max-height)

---

### 3.2 — Adicionar `sectionId` ao `ContextMenu` para páginas

**Arquivo:** `src/components/sidebar/NotebookTree.tsx`

O `ContextMenu` atual recebe `notebookId` mas não `sectionId`. Para que "Mover para..." saiba a section atual da página, precisamos passar o `sectionId`:

```tsx
// NotebookTree.tsx — estado do contextMenu
const [contextMenu, setContextMenu] = useState<{
  x: number;
  y: number;
  type: "notebook" | "section" | "page";
  id: string;
  name: string;
  notebookId?: string;
  sectionId?: string;   // NOVO
} | null>(null);

// No handleContextMenu e na chamada dentro de SectionNode:
onContextMenu={(e) =>
  onContextMenu(e, "page", page.id, page.title, notebookId, sec.id)
}
```

**Arquivo:** `src/components/shared/ContextMenu.tsx`

Adicionar `sectionId?: string` à interface `ContextMenuProps`.

**Critérios:**
- [ ] `sectionId` chegando no `ContextMenu` quando `type === "page"`
- [ ] Sem breaking changes na assinatura para `type === "notebook"` e `type === "section"`

---

### 3.3 — Adicionar item "Mover para..." no `ContextMenu`

**Arquivo:** `src/components/shared/ContextMenu.tsx`

```tsx
import { MovePageDialog } from "./MovePageDialog";
import { ArrowRightLeft } from "lucide-react";

// Dentro de ContextMenu:
const [showMoveDialog, setShowMoveDialog] = useState(false);

// Nos items[], adicionar antes do "Excluir":
if (type === "page") {
  items.push({
    icon: <ArrowRightLeft size={14} />,
    label: t("context_menu.move_to"),
    onClick: () => { setShowMoveDialog(true); },
  });
}

// No render, antes do return do menu normal:
if (showMoveDialog && sectionId) {
  return (
    <MovePageDialog
      pageId={id}
      currentSectionId={sectionId}
      onClose={onClose}
    />
  );
}
```

**Critérios:**
- [ ] Item "Mover para..." visível apenas para `type === "page"`
- [ ] Clicar abre `MovePageDialog`
- [ ] Após mover, página aparece na section de destino na sidebar
- [ ] A página movida permanece selecionada/aberta no editor

---

### 3.4 — Atualizar navegação após mover página

**Arquivo:** `src/stores/usePageStore.ts`

Após `movePage` bem-sucedido, a `currentPage.section_id` muda. O `useNavigationStore.selectedSectionId` precisa ser atualizado para refletir a nova section:

```ts
movePage: async (pageId, targetSectionId) => {
  try {
    await ipc.movePage(pageId, targetSectionId);
    const { pages } = get();
    for (const [sectionId] of pages) {
      await get().loadPages(sectionId);
    }
    // Recarregar a página para atualizar currentPage.section_id
    const { currentPage } = get();
    if (currentPage?.id === pageId) {
      await get().loadPage(pageId);
    }
  } catch (e) {
    set({ error: String(e) });
  }
},
```

**Critérios:**
- [ ] `currentPage.section_id` atualizado após move
- [ ] Sidebar reflete a página na nova section
- [ ] Página permanece aberta no editor (não fecha)

---

### 3.5 — Adicionar strings i18n

**Arquivo:** `src/locales/pt-BR.json`  
**Arquivo:** `src/locales/en.json`

Adicionar as chaves necessárias:

```json
{
  "context_menu": {
    "move_to": "Mover para..."
  },
  "page": {
    "move_to": "Mover página para",
    "current_section": "atual"
  }
}
```

**Critérios:**
- [ ] Todas as strings novas em pt-BR e en
- [ ] Nenhuma string hardcoded em inglês nos componentes novos

---

### 3.6 — Testes

**Arquivo:** `src/components/shared/__tests__/ContextMenu.test.tsx`  
**Arquivo:** `src/components/shared/__tests__/MovePageDialog.test.tsx` (novo)

| Teste | Descrição |
|-------|-----------|
| `page_context_menu_has_move_option` | Renderiza ContextMenu com `type="page"`, verifica item "Mover para..." |
| `page_context_menu_shows_move_dialog_on_click` | Clica "Mover para...", verifica que `MovePageDialog` é exibido |
| `move_dialog_lists_all_sections` | Mock de notebooks/sections, verifica que todas sections aparecem agrupadas |
| `move_dialog_disables_current_section` | Section atual aparece desabilitada |
| `move_dialog_calls_movePage_on_select` | Selecionar uma section chama `movePage(pageId, targetSectionId)` |
| `move_dialog_closes_on_cancel` | Clicar cancelar chama `onClose` |

**Critérios:**
- [ ] 100% dos novos testes passando
- [ ] `npm run test` sem falhas

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src/components/shared/MovePageDialog.tsx` | Novo componente |
| `src/components/shared/ContextMenu.tsx` | Novo item "Mover para..." + prop `sectionId` |
| `src/components/sidebar/NotebookTree.tsx` | Passar `sectionId` no contextMenu state |
| `src/stores/usePageStore.ts` | Recarregar `currentPage` após move |
| `src/locales/pt-BR.json` | Novas strings i18n |
| `src/locales/en.json` | Novas strings i18n |
| `src/components/shared/__tests__/ContextMenu.test.tsx` | Novos testes |
| `src/components/shared/__tests__/MovePageDialog.test.tsx` | Novos testes |

## Arquivos NÃO Modificados

- `src-tauri/src/commands/page.rs` — `move_page` já implementado, sem mudança
- `crates/` — nenhuma mudança no domínio ou storage
- `src/stores/useMultiWorkspaceStore.ts` — sem mudança

---

## Critérios de Aceitação da Fase

- [ ] `npm run test` passa com todos os novos testes
- [ ] `npm run typecheck` sem erros
- [ ] `npm run lint` sem warnings novos
- [ ] Menu de contexto de página exibe "Mover para..."
- [ ] Dialog lista todos os notebooks e sections disponíveis
- [ ] Mover página atualiza sidebar e mantém página aberta no editor
- [ ] Strings em pt-BR e en corretas
- [ ] PR review aprovado

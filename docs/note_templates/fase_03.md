# Fase 03 — UI: Seletor, Menu de Contexto e Gerenciador

**Esforço estimado:** ~8 horas
**Prioridade:** 🟡 Alta
**Dependências:** Fase 1, Fase 2
**Branch:** `feat/note-templates-phase-3`

---

## Objetivo

Implementar toda a interface visual da feature: modal de seleção de templates (`TemplatePickerModal`), modal de salvar como template (`SaveAsTemplateDialog`), integração no menu de contexto da sidebar, e painel de gerenciamento de templates do usuário (`TemplateManagerPanel`). Ao fim desta fase, a feature está completa e pronta para uso.

---

## Contexto Atual

### Padrão de Modal existente (SetPasswordDialog.tsx)

```tsx
// src/components/modals/SetPasswordDialog.tsx — padrão a seguir
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
}

export function SetPasswordDialog({ open, onOpenChange, pageId }: Props) {
  const { t } = useTranslation();
  // ...
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("setPassword.title")}</DialogTitle>
        </DialogHeader>
        {/* conteúdo */}
      </DialogContent>
    </Dialog>
  );
}
```

### Padrão de ContextMenu existente (NotebookTree.tsx)

```tsx
// src/components/sidebar/NotebookTree.tsx
// Menu de contexto de page já tem: Rename, Move, Delete
// Adicionar: "Salvar como template"

const pageContextItems = [
  { label: t("page.rename"), onClick: () => startRename(id) },
  { label: t("page.move"), onClick: () => openMoveDialog(id) },
  { label: t("page.delete"), onClick: () => deletePage(id) },
  // NOVO:
  { label: t("templates.actions.save_as_template"), onClick: () => openSaveAsTemplate(id) },
];
```

### Padrão de stores (usePageStore, useWorkspaceStore)

```tsx
// Na sidebar, ao criar página:
const { createPage } = usePageStore();
// NOVO: também haverá createPageFromTemplate via useTemplateStore
```

---

## Tarefas

### 3.1 — `TemplatePickerModal` em `src/components/modals/TemplatePickerModal.tsx`

**Arquivo:** `src/components/modals/TemplatePickerModal.tsx` (novo)

Modal principal para seleção de template ao criar uma nova página. Exibe built-ins agrupados por categoria e templates do usuário.

```tsx
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId: SectionId;
  onPageCreated: (page: Page) => void;
}

// Layout:
// ┌─────────────────────────────────────────────────┐
// │  Escolher template              [×]             │
// │─────────────────────────────────────────────────│
// │  [🔍 Buscar templates...]                       │
// │─────────────────────────────────────────────────│
// │  EMBUTIDOS                                      │
// │  [📄 Em branco] [📅 Reunião] [📓 Diário]        │
// │  [🗂️ Projeto]  [🎓 Estudo]                      │
// │─────────────────────────────────────────────────│
// │  MEUS TEMPLATES  (só se houver)                 │
// │  [icon Nome]  [icon Nome2]                      │
// │─────────────────────────────────────────────────│
// │  Título da nova página:                         │
// │  [_____________________________]                │
// │                     [Cancelar] [Criar página]  │
// └─────────────────────────────────────────────────┘

export function TemplatePickerModal({ open, onOpenChange, sectionId, onPageCreated }: Props) {
  const { t } = useTranslation();
  const { userTemplates, loadUserTemplates, applyUserTemplate, applyBuiltinTemplate } = useTemplateStore();
  const [selectedBuiltin, setSelectedBuiltin] = useState<BuiltinTemplate | null>(null);
  const [selectedUser, setSelectedUser] = useState<TemplateSummary | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lógica:
  // - Ao abrir, chama loadUserTemplates()
  // - Ao selecionar um template, pre-preenche customTitle com resolve_title()
  // - Ao clicar "Criar página":
  //   - Se builtin: applyBuiltinTemplate(sectionId, selected, customTitle)
  //   - Se user: applyUserTemplate(sectionId, selected.id, customTitle)
  //   - Chama onPageCreated(page) e fecha o modal
  // - Filtra templates por search (case-insensitive no nome)
}
```

**Estados visuais a implementar:**
- Loading inicial (skeleton cards enquanto `isLoading`)
- Card selecionado (border accent, check mark)
- Botão "Criar página" desabilitado até selecionar um template
- Erro inline (toast ou mensagem no modal)
- Estado vazio de "Meus templates" (ocultar seção)

**Critérios:**
- [ ] Modal exibe 5 templates embutidos agrupados
- [ ] Seção "Meus templates" só aparece se houver templates do usuário
- [ ] Busca filtra nome de templates embutidos e do usuário
- [ ] `customTitle` pre-preenchido ao selecionar template (resolvendo `{{date}}`)
- [ ] `customTitle` editável pelo usuário antes de criar
- [ ] Cria página e fecha modal via `onPageCreated`
- [ ] Loading state durante criação
- [ ] Testes de componente Vitest

---

### 3.2 — `SaveAsTemplateDialog` em `src/components/modals/SaveAsTemplateDialog.tsx`

**Arquivo:** `src/components/modals/SaveAsTemplateDialog.tsx` (novo)

Dialog para salvar uma página existente como template de usuário.

```tsx
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: PageId;
  pageTitleSuggestion: string;
}

// Layout:
// ┌─────────────────────────────────────────────────┐
// │  Salvar como template           [×]             │
// │─────────────────────────────────────────────────│
// │  Nome do template *                             │
// │  [Reunião semanal________________]              │
// │                                                 │
// │  Descrição (opcional)                           │
// │  [________________________________]             │
// │                                                 │
// │  Categoria                                      │
// │  [Personalizado ▼]                              │
// │                                                 │
// │  ⚠ Templates com imagens não são suportados     │
// │                                                 │
// │               [Cancelar]  [Salvar template]    │
// └─────────────────────────────────────────────────┘

export function SaveAsTemplateDialog({ open, onOpenChange, pageId, pageTitleSuggestion }: Props) {
  const { t } = useTranslation();
  const { createFromPage } = useTemplateStore();
  const [name, setName] = useState(pageTitleSuggestion);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("custom");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ao submeter: createFromPage(pageId, name, description || null, category)
  // Sucesso: toast "Template salvo com sucesso" + fechar
  // Erro com "image" na mensagem: exibir t("templates.save_dialog.error_image_blocks")
  // Erro protegida: exibir t("templates.errors.protected_page")
}
```

**Critérios:**
- [ ] Nome pre-preenchido com título da página
- [ ] Categoria selecionável (5 opções do enum `TemplateCategory`)
- [ ] Erro de `ImageBlock` exibido com mensagem amigável
- [ ] Erro de página protegida exibido corretamente
- [ ] Feedback de sucesso (toast)
- [ ] Testes de componente Vitest

---

### 3.3 — Integrar menu de contexto em `NotebookTree.tsx`

**Arquivo:** `src/components/sidebar/NotebookTree.tsx`

Adicionar "Salvar como template" ao menu de contexto de página:

```tsx
// Localizar a seção de context menu items para type === "page"
// Adicionar após o item de "move":

if (ctxMenu?.type === "page") {
  items.push({
    label: t("templates.actions.save_as_template"),
    icon: <LayoutTemplate size={14} />,
    onClick: () => {
      setSaveAsTemplatePageId(ctxMenu.id);
      setSaveAsTemplateTitle(ctxMenu.name);
      setCtxMenu(null);
    },
  });
}
```

Estado local adicional:
```tsx
const [saveAsTemplatePageId, setSaveAsTemplatePageId] = useState<string | null>(null);
const [saveAsTemplateTitle, setSaveAsTemplateTitle] = useState("");
```

E renderização do modal:
```tsx
{saveAsTemplatePageId && (
  <SaveAsTemplateDialog
    open={!!saveAsTemplatePageId}
    onOpenChange={(open) => !open && setSaveAsTemplatePageId(null)}
    pageId={saveAsTemplatePageId as PageId}
    pageTitleSuggestion={saveAsTemplateTitle}
  />
)}
```

**Adicionar ao botão "Nova página":** ao clicar com a opção expandida (ou via botão secundário), exibir opções:
- "Página em branco" (comportamento atual)
- "A partir de template..." (abre `TemplatePickerModal`)

```tsx
// Na área de criação de page de cada section, adicionar dropdown:
// [+ Nova página ▾]
//   ├── Página em branco
//   └── A partir de template...

const [templatePickerSection, setTemplatePickerSection] = useState<SectionId | null>(null);
```

**Ícone a importar de lucide-react:** `LayoutTemplate`

**Critérios:**
- [ ] "Salvar como template" aparece no menu de contexto de páginas (não seções, não notebooks)
- [ ] `SaveAsTemplateDialog` abre com título da página pre-preenchido
- [ ] Botão "Nova página" expande com opção "A partir de template..."
- [ ] `TemplatePickerModal` abre corretamente com `sectionId` correto
- [ ] Após criar página via template, página é selecionada na sidebar

---

### 3.4 — `TemplateManagerPanel` em `src/components/settings/TemplateManagerPanel.tsx`

**Arquivo:** `src/components/settings/TemplateManagerPanel.tsx` (novo)

Painel de gerenciamento de templates do usuário, acessível via Settings ou modal dedicado.

```tsx
// Layout:
// ┌─────────────────────────────────────────────────┐
// │  Meus Templates                                 │
// │─────────────────────────────────────────────────│
// │  [Nome]          [Categoria] [Blocos] [×]       │
// │  [Nome 2]        [Categoria] [Blocos] [×]       │
// │─────────────────────────────────────────────────│
// │  Nenhum template salvo ainda.                   │
// │  Salve uma página como template para vê-la aqui.│
// └─────────────────────────────────────────────────┘

export function TemplateManagerPanel() {
  const { t } = useTranslation();
  const { userTemplates, loadUserTemplates, deleteUserTemplate } = useTemplateStore();
  const [deletingId, setDeletingId] = useState<TemplateId | null>(null);

  // Confirmar antes de deletar (Dialog de confirmação)
  // Mostrar categoria traduzida (t(`templates.category.${template.category}`))
  // Mostrar contagem de blocos
  // Estado vazio com mensagem orientando o usuário
}
```

**Integrar no painel de Settings:**
Adicionar seção "Templates" na tela de configurações existente (`src/components/settings/`).

**Critérios:**
- [ ] Lista templates do usuário com nome, categoria e contagem de blocos
- [ ] Botão excluir com confirmação (evitar deleção acidental)
- [ ] Estado vazio com mensagem orientativa
- [ ] Acessível via Settings

---

### 3.5 — Testes de Componente Vitest

**Arquivo:** `src/components/modals/__tests__/TemplatePickerModal.test.tsx` (novo)

| Teste | Descrição |
|-------|-----------|
| `renders_builtin_templates` | 5 templates embutidos renderizados |
| `search_filters_templates` | Busca por "Reunião" mostra apenas matching |
| `select_template_prefills_title` | Selecionar template pre-preenche `customTitle` |
| `create_button_disabled_without_selection` | Botão desabilitado antes de selecionar |
| `creates_page_on_submit` | `applyBuiltinTemplate` chamado e modal fecha |
| `shows_user_templates_section` | Seção "Meus templates" aparece se `userTemplates.length > 0` |
| `hides_user_templates_section_when_empty` | Seção oculta sem templates de usuário |

**Arquivo:** `src/components/modals/__tests__/SaveAsTemplateDialog.test.tsx` (novo)

| Teste | Descrição |
|-------|-----------|
| `prefills_name_with_page_title` | Input de nome pre-preenchido |
| `submits_with_correct_data` | `createFromPage` chamado com dados corretos |
| `shows_image_block_error` | Mensagem de erro ao receber erro de ImageBlock |
| `shows_protected_page_error` | Mensagem de erro ao tentar protegida |
| `closes_on_success` | Modal fecha após salvar com sucesso |

**Critérios:**
- [ ] `npm test` passa com todos os testes
- [ ] Coverage ≥ 85% nos componentes novos

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src/components/modals/TemplatePickerModal.tsx` | **Novo** |
| `src/components/modals/SaveAsTemplateDialog.tsx` | **Novo** |
| `src/components/settings/TemplateManagerPanel.tsx` | **Novo** |
| `src/components/sidebar/NotebookTree.tsx` | Alteração — menu de contexto + botão nova página |
| `src/components/modals/__tests__/TemplatePickerModal.test.tsx` | **Novo** |
| `src/components/modals/__tests__/SaveAsTemplateDialog.test.tsx` | **Novo** |

## Arquivos NÃO Modificados (ainda)

- `crates/` — backend completo desde Fase 1
- `src/lib/ipc.ts` — completo desde Fase 1
- `src/stores/useTemplateStore.ts` — completo desde Fase 2
- `src/locales/` — completo desde Fase 2
- `e2e/` — testes E2E ficam para trabalho futuro (fora do escopo desta Fase)

---

## Critérios de Aceitação da Fase

- [ ] `cargo test --workspace` passa
- [ ] `cargo clippy --workspace -- -D warnings` sem warnings
- [ ] `npm run typecheck` sem erros
- [ ] `npm test` passa com todos os novos testes de componente
- [ ] Fluxo completo funcional: Sidebar → "A partir de template..." → Selecionar "Reunião" → Criar página → Página aberta no editor com blocos do template
- [ ] Fluxo de save: Página existente → Menu de contexto → "Salvar como template" → Template aparece em "Meus templates" no seletor
- [ ] Fluxo de delete: Settings → Templates → Excluir template → Template removido do seletor
- [ ] i18n funcionando em pt-BR e en (sem string hardcoded)
- [ ] Nenhuma breaking change em fluxos existentes (criar página em branco ainda funciona)
- [ ] PR review aprovado

# Fase 02 — Templates Embutidos + Apply no Frontend

**Esforço estimado:** ~5 horas
**Prioridade:** 🔴 Crítica
**Dependências:** Fase 1
**Branch:** `feat/note-templates-phase-2`

---

## Objetivo

Definir os templates embutidos como dados estáticos no frontend (TypeScript), criar o Zustand store `useTemplateStore`, implementar o hook `useApplyTemplate` que orquestra a criação de página, e adicionar as strings de i18n. Ao fim desta fase, é possível programaticamente aplicar qualquer template (embutido ou de usuário) para criar uma nova página — sem UI visual ainda.

---

## Contexto Atual

### IPC disponível após Fase 1

```typescript
// src/lib/ipc.ts
listTemplates(workspaceId?)           → TemplateSummary[]
createTemplateFromPage(...)           → TemplateSummary
deleteTemplate(templateId, ...)       → void
createPageFromTemplate(sectionId, templateId, customTitle?, ...) → Page
createPage(sectionId, title, ...)     → Page  // já existe — usado para built-ins
```

### Padrão de Zustand Store existente (usePageStore)

```typescript
// src/stores/usePageStore.ts — padrão a seguir
interface PageStore {
  pages: Record<SectionId, PageSummary[]>;
  currentPage: Page | null;
  // ...
  createPage: (sectionId: SectionId, title: string) => Promise<Page>;
  loadPage: (pageId: PageId) => Promise<Page>;
}

export const usePageStore = create<PageStore>((set, get) => ({
  // ...
}));
```

---

## Tarefas

### 2.1 — Definir templates embutidos em `src/lib/builtinTemplates.ts`

**Arquivo:** `src/lib/builtinTemplates.ts` (novo)

Templates embutidos são definidos como dados estáticos TypeScript. Não são persistidos em disco — existem apenas em memória, identificados por IDs fixos prefixados com `builtin-`.

```typescript
import type { Block } from "@/types/bindings/Block";
import type { EditorPreferences } from "@/types/bindings/EditorPreferences";
import type { TemplateCategory } from "@/types/bindings/TemplateCategory";

export interface BuiltinTemplate {
  id: string;           // formato: "builtin-<slug>"
  name: string;         // chave i18n: templates.builtin.<slug>.name
  descriptionKey: string; // chave i18n
  category: TemplateCategory;
  icon: string;         // emoji
  titleTemplate: string;
  tags: string[];
  blocks: Block[];
  editorPreferences: EditorPreferences;
  isBuiltin: true;
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: "builtin-blank",
    name: "templates.builtin.blank.name",
    descriptionKey: "templates.builtin.blank.description",
    category: "custom",
    icon: "📄",
    titleTemplate: "{{date}}",
    tags: [],
    blocks: [],
    editorPreferences: { mode: "rich_text", split_view: false },
    isBuiltin: true,
  },
  {
    id: "builtin-meeting",
    name: "templates.builtin.meeting.name",
    descriptionKey: "templates.builtin.meeting.description",
    category: "meeting",
    icon: "📅",
    titleTemplate: "Reunião — {{date}}",
    tags: ["reunião"],
    blocks: [
      // TextBlock: Heading "Participantes"
      // TextBlock: Heading "Pauta"
      // ChecklistBlock: 3 itens vazios (action items)
      // TextBlock: Heading "Próximos passos"
    ],
    editorPreferences: { mode: "rich_text", split_view: false },
    isBuiltin: true,
  },
  {
    id: "builtin-daily-journal",
    name: "templates.builtin.daily_journal.name",
    descriptionKey: "templates.builtin.daily_journal.description",
    category: "journal",
    icon: "📓",
    titleTemplate: "Diário — {{date}}",
    tags: ["diário"],
    blocks: [
      // TextBlock: "Como me sinto hoje?"
      // TextBlock: "O que quero realizar?"
      // ChecklistBlock: 3 tarefas do dia
      // TextBlock: "Reflexão do dia"
    ],
    editorPreferences: { mode: "rich_text", split_view: false },
    isBuiltin: true,
  },
  {
    id: "builtin-project",
    name: "templates.builtin.project.name",
    descriptionKey: "templates.builtin.project.description",
    category: "project",
    icon: "🗂️",
    titleTemplate: "Projeto — {{date}}",
    tags: ["projeto"],
    blocks: [
      // TextBlock: Heading "Objetivo"
      // TextBlock: Heading "Escopo"
      // TableBlock: Cronograma (Tarefa | Responsável | Prazo | Status)
      // CalloutBlock variant=tip: "Lembre-se de atualizar o status semanalmente"
    ],
    editorPreferences: { mode: "rich_text", split_view: false },
    isBuiltin: true,
  },
  {
    id: "builtin-study",
    name: "templates.builtin.study.name",
    descriptionKey: "templates.builtin.study.description",
    category: "study",
    icon: "🎓",
    titleTemplate: "Estudo — {{date}}",
    tags: ["estudo"],
    blocks: [
      // TextBlock: Heading "Tema"
      // TextBlock: Heading "Objetivos de aprendizado"
      // TextBlock: Heading "Notas"
      // TextBlock: Heading "Resumo"
      // CalloutBlock variant=info: "Revise este material em 24h para fixar"
    ],
    editorPreferences: { mode: "rich_text", split_view: false },
    isBuiltin: true,
  },
];

/**
 * Resolve placeholders em titleTemplate:
 *   {{date}} → data atual em YYYY-MM-DD
 */
export function resolveTemplateTitle(titleTemplate: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return titleTemplate.replace(/\{\{date\}\}/g, today);
}
```

> **Nota de implementação:** os campos `blocks` acima mostram a intenção. Na implementação real, preencher com objetos `Block` completos e válidos (com `id`, `order`, `created_at`, `updated_at`, etc.), usando UUIDs gerados na definição estática. Como os IDs de bloco não colidem com pages reais, podem ser UUIDs v4 fixos.

**Critérios:**
- [ ] 5 templates embutidos definidos (`blank`, `meeting`, `daily_journal`, `project`, `study`)
- [ ] `resolveTemplateTitle("{{date}}")` retorna string no formato `YYYY-MM-DD`
- [ ] Nenhum `ImageBlock` nos templates embutidos
- [ ] Testes Vitest para `resolveTemplateTitle`

---

### 2.2 — Criar `useTemplateStore` em `src/stores/useTemplateStore.ts`

**Arquivo:** `src/stores/useTemplateStore.ts` (novo)

```typescript
import { create } from "zustand";
import type { TemplateSummary } from "@/types/bindings/TemplateSummary";
import type { TemplateCategory } from "@/types/bindings/TemplateCategory";
import type { Page } from "@/types/bindings/Page";
import type { PageId } from "@/types/bindings/PageId";
import type { SectionId } from "@/types/bindings/SectionId";
import type { TemplateId } from "@/types/bindings/TemplateId";
import {
  listTemplates,
  createTemplateFromPage,
  deleteTemplate,
  createPageFromTemplate,
} from "@/lib/ipc";
import { BUILTIN_TEMPLATES, resolveTemplateTitle, type BuiltinTemplate } from "@/lib/builtinTemplates";

interface TemplateStore {
  userTemplates: TemplateSummary[];
  isLoading: boolean;
  error: string | null;

  loadUserTemplates: (workspaceId?: string) => Promise<void>;
  createFromPage: (
    pageId: PageId,
    name: string,
    description: string | null,
    category: TemplateCategory,
    workspaceId?: string,
  ) => Promise<TemplateSummary>;
  deleteUserTemplate: (templateId: TemplateId, workspaceId?: string) => Promise<void>;
  applyUserTemplate: (
    sectionId: SectionId,
    templateId: TemplateId,
    customTitle?: string,
    workspaceId?: string,
  ) => Promise<Page>;
  applyBuiltinTemplate: (
    sectionId: SectionId,
    template: BuiltinTemplate,
    customTitle?: string,
    workspaceId?: string,
  ) => Promise<Page>;
}

export const useTemplateStore = create<TemplateStore>((set) => ({
  userTemplates: [],
  isLoading: false,
  error: null,

  loadUserTemplates: async (workspaceId) => {
    set({ isLoading: true, error: null });
    try {
      const templates = await listTemplates(workspaceId);
      set({ userTemplates: templates, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  createFromPage: async (pageId, name, description, category, workspaceId) => {
    const template = await createTemplateFromPage(pageId, name, description, category, workspaceId);
    set((state) => ({ userTemplates: [template, ...state.userTemplates] }));
    return template;
  },

  deleteUserTemplate: async (templateId, workspaceId) => {
    await deleteTemplate(templateId, workspaceId);
    set((state) => ({
      userTemplates: state.userTemplates.filter((t) => t.id !== templateId),
    }));
  },

  applyUserTemplate: async (sectionId, templateId, customTitle, workspaceId) => {
    return createPageFromTemplate(sectionId, templateId, customTitle ?? null, workspaceId);
  },

  applyBuiltinTemplate: async (sectionId, template, customTitle, workspaceId) => {
    const { createPage, updatePageBlocks } = await import("@/lib/ipc");
    const title = customTitle?.trim() || resolveTemplateTitle(template.titleTemplate);
    const page = await createPage(sectionId, title, workspaceId);
    if (template.blocks.length > 0) {
      return updatePageBlocks(page.id, template.blocks, workspaceId);
    }
    return page;
  },
}));

export { BUILTIN_TEMPLATES };
```

**Critérios:**
- [ ] `loadUserTemplates` popula `userTemplates` a partir do IPC
- [ ] `applyBuiltinTemplate` cria página e aplica blocos do template embutido
- [ ] `deleteUserTemplate` remove do estado local após sucesso no IPC
- [ ] Testes Vitest com mock de IPC (MSW ou `vi.mock("@/lib/ipc")`)

---

### 2.3 — Strings i18n

**Arquivo:** `src/locales/pt-BR.json` (adições)

```json
{
  "templates": {
    "title": "Templates",
    "builtin": {
      "blank": {
        "name": "Página em branco",
        "description": "Começa com uma página vazia"
      },
      "meeting": {
        "name": "Reunião",
        "description": "Pauta, participantes e próximos passos"
      },
      "daily_journal": {
        "name": "Diário",
        "description": "Reflexões e tarefas do dia"
      },
      "project": {
        "name": "Projeto",
        "description": "Objetivo, escopo e cronograma"
      },
      "study": {
        "name": "Estudo",
        "description": "Notas e resumo de aprendizado"
      }
    },
    "category": {
      "meeting": "Reunião",
      "journal": "Diário",
      "project": "Projeto",
      "study": "Estudo",
      "custom": "Personalizado"
    },
    "actions": {
      "use_template": "Usar template",
      "save_as_template": "Salvar como template",
      "delete_template": "Excluir template",
      "create_from_template": "Criar a partir do template"
    },
    "save_dialog": {
      "title": "Salvar como template",
      "name_label": "Nome do template",
      "name_placeholder": "Ex: Reunião semanal",
      "description_label": "Descrição (opcional)",
      "category_label": "Categoria",
      "submit": "Salvar template",
      "error_image_blocks": "Templates com imagens não são suportados. Remova os blocos de imagem antes de salvar."
    },
    "errors": {
      "load_failed": "Erro ao carregar templates",
      "save_failed": "Erro ao salvar template",
      "delete_failed": "Erro ao excluir template",
      "apply_failed": "Erro ao criar página a partir do template",
      "protected_page": "Não é possível criar template a partir de uma página protegida"
    }
  }
}
```

**Arquivo:** `src/locales/en.json` (adições equivalentes em inglês)

```json
{
  "templates": {
    "title": "Templates",
    "builtin": {
      "blank": { "name": "Blank page", "description": "Start with an empty page" },
      "meeting": { "name": "Meeting", "description": "Agenda, attendees and next steps" },
      "daily_journal": { "name": "Daily journal", "description": "Reflections and tasks of the day" },
      "project": { "name": "Project", "description": "Objective, scope and timeline" },
      "study": { "name": "Study notes", "description": "Notes and learning summary" }
    },
    "category": {
      "meeting": "Meeting",
      "journal": "Journal",
      "project": "Project",
      "study": "Study",
      "custom": "Custom"
    },
    "actions": {
      "use_template": "Use template",
      "save_as_template": "Save as template",
      "delete_template": "Delete template",
      "create_from_template": "Create from template"
    },
    "save_dialog": {
      "title": "Save as template",
      "name_label": "Template name",
      "name_placeholder": "E.g. Weekly meeting",
      "description_label": "Description (optional)",
      "category_label": "Category",
      "submit": "Save template",
      "error_image_blocks": "Templates with images are not supported. Remove image blocks before saving."
    },
    "errors": {
      "load_failed": "Failed to load templates",
      "save_failed": "Failed to save template",
      "delete_failed": "Failed to delete template",
      "apply_failed": "Failed to create page from template",
      "protected_page": "Cannot create template from a protected page"
    }
  }
}
```

**Critérios:**
- [ ] Todas as keys usadas no código existem em `pt-BR.json` e `en.json`
- [ ] Nenhuma string visível hardcoded nos arquivos `.tsx` desta feature

---

### 2.4 — Testes Vitest

**Arquivo:** `src/lib/__tests__/builtinTemplates.test.ts` (novo)

| Teste | Descrição |
|-------|-----------|
| `resolveTemplateTitle_date` | `{{date}}` substituído por `YYYY-MM-DD` |
| `resolveTemplateTitle_no_placeholder` | Título sem placeholder retorna inalterado |
| `resolveTemplateTitle_multiple` | Múltiplos `{{date}}` todos substituídos |
| `builtin_templates_have_unique_ids` | IDs de built-ins são únicos |
| `builtin_templates_no_image_blocks` | Nenhum built-in contém `ImageBlock` |

**Arquivo:** `src/stores/__tests__/useTemplateStore.test.ts` (novo)

| Teste | Descrição |
|-------|-----------|
| `loadUserTemplates_populates_store` | Lista do IPC popula `userTemplates` |
| `createFromPage_adds_to_store` | Template novo adicionado na frente da lista |
| `deleteUserTemplate_removes_from_store` | Template removido do estado |
| `applyBuiltinTemplate_creates_page` | Chama `createPage` e `updatePageBlocks` |
| `applyBuiltinTemplate_blank_no_blocks_call` | Template blank não chama `updatePageBlocks` |

**Critérios:**
- [ ] `npm test` passa
- [ ] Coverage ≥ 85% nos arquivos novos desta fase

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src/lib/builtinTemplates.ts` | **Novo** |
| `src/stores/useTemplateStore.ts` | **Novo** |
| `src/locales/pt-BR.json` | Alteração — adicionar chave `templates` |
| `src/locales/en.json` | Alteração — adicionar chave `templates` |
| `src/lib/__tests__/builtinTemplates.test.ts` | **Novo** |
| `src/stores/__tests__/useTemplateStore.test.ts` | **Novo** |

## Arquivos NÃO Modificados (ainda)

- `src/components/` — UI na Fase 3
- `src-tauri/` — backend completo desde Fase 1
- `src/components/sidebar/NotebookTree.tsx` — menu de contexto na Fase 3

---

## Critérios de Aceitação da Fase

- [ ] `cargo test --workspace` passa (sem mudanças no Rust desta fase)
- [ ] `npm run typecheck` sem erros
- [ ] `npm test` passa incluindo os novos testes Vitest
- [ ] 5 templates embutidos com conteúdo real (não apenas estrutura vazia)
- [ ] i18n completo em pt-BR e en
- [ ] PR review aprovado

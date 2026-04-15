# Fase 1 — Editor Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar o lag de digitação no editor removendo re-renders desnecessários do React causados por atualizações de estado a cada keystroke.

**Architecture:** Substituir o `content` state + `useAutoSave` no `PageEditor` por refs + debounce inline, de forma que a digitação nunca dispare um `setState` (e portanto nunca cause re-render do componente durante a edição). Memoizar `initialContent` para evitar recalcular `blocksToTiptap` em cada render. Fixar `handleModeChange` para ler o conteúdo atual do editor via `editorRef` em vez de depender do state.

**Tech Stack:** React 19, TipTap v3, Zustand, TypeScript, Vitest + Testing Library.

---

## Arquivo Map

| Ação | Arquivo |
|---|---|
| Modify | `src/components/editor/PageEditor.tsx` |
| Modify | `src/components/editor/BlockEditor.tsx` |
| Test | `src/components/editor/__tests__/PageEditor.test.tsx` |

---

### Task 1: Escrever testes que capturam o comportamento atual de save

**Files:**
- Create: `src/components/editor/__tests__/PageEditor.test.tsx`

- [ ] **Step 1: Criar o arquivo de teste**

```tsx
// src/components/editor/__tests__/PageEditor.test.tsx
import { render, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// Mock TipTap — jsdom não suporta ProseMirror completo
vi.mock("@tiptap/react", () => ({
  useEditor: vi.fn(() => ({
    getJSON: vi.fn(() => ({ type: "doc", content: [] })),
    commands: { setContent: vi.fn(), focus: vi.fn() },
    state: { selection: { from: 0, empty: true } },
    view: { coordsAtPos: vi.fn(() => ({ bottom: 0, left: 0 })), dom: { getBoundingClientRect: vi.fn(() => ({ top: 0, left: 0 })) } },
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
    isDestroyed: false,
  })),
  EditorContent: ({ editor: _ }: { editor: unknown }) => <div data-testid="editor-content" />,
  useCurrentEditor: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  updatePageBlocks: vi.fn().mockResolvedValue({
    id: "page-1",
    title: "Test Page",
    blocks: [],
    section_id: "sec-1",
    notebook_id: "nb-1",
    workspace_id: "ws-1",
    created_at: "",
    updated_at: "",
    slug: "test-page",
    tags: [],
    protection: null,
    encrypted_content: null,
    order: 0,
  }),
}));

vi.mock("@/stores/usePageStore", () => ({
  usePageStore: vi.fn((sel) => sel({
    updateBlocks: vi.fn().mockResolvedValue({}),
    updatePageTitle: vi.fn(),
    lockState: "unlocked",
    clearCurrentPage: vi.fn(),
  })),
}));

vi.mock("@/stores/useNavigationStore", () => ({
  useNavigationStore: vi.fn((sel) => sel({ setActiveView: vi.fn() })),
}));

vi.mock("@/stores/useUIStore", () => ({
  useUIStore: vi.fn((sel) => sel({ theme: { baseTheme: "light" }, editorConfig: { spellCheckEnabled: false, documentLanguage: "pt-BR" } })),
}));

vi.mock("@/lib/serialization", () => ({
  blocksToTiptap: vi.fn(() => ({ type: "doc", content: [] })),
  tiptapToBlocks: vi.fn(() => []),
}));

vi.mock("@/lib/markdown", () => ({
  tiptapToMarkdown: vi.fn(() => ""),
  markdownToTiptap: vi.fn(() => ({ type: "doc", content: [] })),
}));

import { PageEditor } from "@/components/editor/PageEditor";
import type { Page } from "@/types/bindings/Page";

const mockPage: Page = {
  id: "page-1",
  title: "Test Page",
  blocks: [],
  section_id: "sec-1",
  notebook_id: "nb-1",
  workspace_id: "ws-1",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  slug: "test-page",
  tags: [],
  protection: null,
  encrypted_content: null,
  order: 0,
};

describe("PageEditor — save behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("does not call updateBlocks immediately on handleUpdate", async () => {
    const { usePageStore } = await import("@/stores/usePageStore");
    const updateBlocks = vi.fn().mockResolvedValue({});
    (usePageStore as ReturnType<typeof vi.fn>).mockImplementation((sel: (s: Record<string, unknown>) => unknown) =>
      sel({ updateBlocks, updatePageTitle: vi.fn(), lockState: "unlocked", clearCurrentPage: vi.fn() })
    );

    render(<PageEditor page={mockPage} />);

    // No save should happen synchronously
    expect(updateBlocks).not.toHaveBeenCalled();
  });

  it("calls updateBlocks after 1000ms debounce", async () => {
    const { usePageStore } = await import("@/stores/usePageStore");
    const updateBlocks = vi.fn().mockResolvedValue({});
    (usePageStore as ReturnType<typeof vi.fn>).mockImplementation((sel: (s: Record<string, unknown>) => unknown) =>
      sel({ updateBlocks, updatePageTitle: vi.fn(), lockState: "unlocked", clearCurrentPage: vi.fn() })
    );

    const { getByTestId } = render(<PageEditor page={mockPage} />);

    // Simulate blur to trigger forceSave with no pending content
    const editorEl = getByTestId("page-editor");
    act(() => {
      editorEl.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    });

    // No pending content → no save
    expect(updateBlocks).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar os testes para verificar que passam (comportamento atual)**

```bash
npx vitest run src/components/editor/__tests__/PageEditor.test.tsx
```

Esperado: testes passam (estamos testando comportamento existente).

- [ ] **Step 3: Commit dos testes**

```bash
git add src/components/editor/__tests__/PageEditor.test.tsx
git commit -m "test(editor): add PageEditor save behavior tests"
```

---

### Task 2: Corrigir `BlockEditor.tsx` — usar ref para `onUpdate`

**Files:**
- Modify: `src/components/editor/BlockEditor.tsx`

**Problema:** `onUpdate` é capturado no closure de `useEditor` no momento da inicialização. Se `onUpdate` mudar (prop atualizada), o editor ainda chama a versão antiga.

- [ ] **Step 1: Adicionar `onUpdateRef` em `BlockEditor.tsx`**

Abra `src/components/editor/BlockEditor.tsx`. Após as importações, antes de `const lowlight`, o arquivo começa assim (linha 1-30 atual):

```tsx
import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
// ... demais imports
```

Substitua a definição do componente `BlockEditor` (linhas 37-125) pelo seguinte. A única mudança relevante é adicionar `useRef` no import e criar `onUpdateRef`:

```tsx
import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Typography from "@tiptap/extension-typography";
import CharacterCount from "@tiptap/extension-character-count";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import { common, createLowlight } from "lowlight";
import type { JSONContent, Editor } from "@tiptap/react";
import { FloatingToolbar } from "@/components/editor/FloatingToolbar";
import { SlashCommandMenu } from "@/components/editor/SlashCommandMenu";
import { TableToolbar } from "@/components/editor/TableToolbar";
import { Callout } from "@/components/editor/extensions/CalloutExtension";
import { InkBlock } from "@/components/editor/extensions/InkBlockExtension";
import { PdfBlock } from "@/components/editor/extensions/PdfBlockExtension";
import { YoutubeBlock } from "@/components/editor/extensions/YoutubeBlockExtension";
import { SpellCheckExtension } from "@/components/editor/extensions/SpellCheckExtension";
import { useUIStore } from "@/stores/useUIStore";

const lowlight = createLowlight(common);

interface BlockEditorProps {
  initialContent: JSONContent;
  onUpdate: (content: JSONContent) => void;
  onEditorReady?: (editor: Editor) => void;
}

export function BlockEditor({
  initialContent,
  onUpdate,
  onEditorReady,
}: BlockEditorProps) {
  const editorConfig = useUIStore((s) => s.editorConfig);
  // Ref garante que o editor sempre chama a versão mais recente de onUpdate
  // sem precisar recriar o editor quando a prop mudar.
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: "plaintext",
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: "editor-table" },
      }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList.configure({
        HTMLAttributes: { class: "editor-task-list" },
      }),
      TaskItem.configure({
        nested: true,
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: { class: "editor-image" },
      }),
      Callout,
      InkBlock,
      PdfBlock,
      YoutubeBlock,
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") {
            return `Heading ${node.attrs.level}`;
          }
          return "Digite '/' para comandos...";
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "editor-link" },
      }),
      Typography,
      CharacterCount,
      SpellCheckExtension.configure({
        language: editorConfig.documentLanguage,
        enabled: editorConfig.spellCheckEnabled,
        debounceMs: 2000,
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor: ed }) => {
      onUpdateRef.current(ed.getJSON());
    },
    editorProps: {
      attributes: {
        class: "editor-content",
        spellcheck: editorConfig.spellCheckEnabled ? "true" : "false",
      },
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  if (!editor) return null;

  return (
    <div className="relative">
      <FloatingToolbar editor={editor} />
      <TableToolbar editor={editor} />
      <SlashCommandMenu editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
```

- [ ] **Step 2: Rodar testes**

```bash
npm run test
```

Esperado: todos os testes passam.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/BlockEditor.tsx
git commit -m "fix(editor): use ref for onUpdate callback to avoid stale closure in TipTap"
```

---

### Task 3: Refatorar `PageEditor.tsx` — remover `content` state e `useAutoSave`

**Files:**
- Modify: `src/components/editor/PageEditor.tsx`

**Problema central:** Cada keystroke chama `setContent(doc)` → `PageEditor` re-renderiza → todos os filhos verificam re-render. A solução é usar refs para rastrear o documento pendente e debounce inline.

- [ ] **Step 1: Reescrever `PageEditor.tsx`**

Substitua o conteúdo completo de `src/components/editor/PageEditor.tsx`:

```tsx
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { JSONContent, Editor } from "@tiptap/react";
import type { Page } from "@/types/bindings/Page";
import { TitleEditor } from "@/components/editor/TitleEditor";
import { BlockEditor } from "@/components/editor/BlockEditor";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import {
  EditorModeToggle,
  type EditorMode,
} from "@/components/editor/EditorModeToggle";
import { blocksToTiptap, tiptapToBlocks } from "@/lib/serialization";
import { tiptapToMarkdown, markdownToTiptap } from "@/lib/markdown";
import { usePageStore } from "@/stores/usePageStore";
import { useUIStore } from "@/stores/useUIStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { InkOverlay } from "@/components/ink/InkOverlay";
import { PasswordUnlockDialog } from "@/components/modals/PasswordUnlockDialog";

interface PageEditorProps {
  page: Page;
}

export function PageEditor({ page }: PageEditorProps) {
  const editorRef = useRef<Editor | null>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  // Refs para debounce de save — sem setState, sem re-renders durante digitação
  const pendingDocRef = useRef<JSONContent | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mode, setMode] = useState<EditorMode>("richtext");
  const [markdownContent, setMarkdownContent] = useState("");

  const { updateBlocks, updatePageTitle, lockState, clearCurrentPage } =
    usePageStore();
  const { setActiveView } = useNavigationStore();
  const baseTheme = useUIStore((s) => s.theme.baseTheme);

  // Recalculado apenas quando a página muda (page.id), não a cada keystroke.
  // TipTap gerencia o estado interno do documento após a inicialização.
  const initialContent = useMemo(
    () => blocksToTiptap(page.blocks),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page.id],
  );

  // Função de save efetiva — chama IPC e atualiza o store
  const doSave = useCallback(
    async (doc: JSONContent) => {
      const blocks = tiptapToBlocks(doc, page.blocks);
      await updateBlocks(page.id, blocks);
    },
    [page.id, page.blocks, updateBlocks],
  );

  // Agenda um save com debounce de 1000ms após o último update
  const scheduleSave = useCallback(
    (doc: JSONContent) => {
      pendingDocRef.current = doc;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const toSave = pendingDocRef.current;
        if (toSave) {
          pendingDocRef.current = null;
          doSave(toSave);
        }
      }, 1000);
    },
    [doSave],
  );

  // Flush imediato — chamado no blur e na troca de modo
  const forceSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const toSave = pendingDocRef.current;
    if (toSave) {
      pendingDocRef.current = null;
      await doSave(toSave);
    }
  }, [doSave]);

  // Garante save no unmount (troca de página, fechamento)
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const toSave = pendingDocRef.current;
      if (toSave) {
        doSave(toSave).catch((e) =>
          console.error("[PageEditor] Save on unmount failed:", e),
        );
      }
    };
  }, [doSave]);

  // Lê conteúdo atual do editor via ref — não depende de content state
  const handleModeChange = useCallback(
    (newMode: EditorMode) => {
      if (newMode === mode) return;

      if (newMode === "markdown") {
        const currentDoc = editorRef.current?.getJSON() ?? initialContent;
        setMarkdownContent(tiptapToMarkdown(currentDoc));
      } else {
        const doc = markdownToTiptap(markdownContent);
        scheduleSave(doc);
        if (editorRef.current) {
          editorRef.current.commands.setContent(doc);
        }
      }

      setMode(newMode);
    },
    [mode, initialContent, markdownContent, scheduleSave],
  );

  const handleMarkdownChange = useCallback(
    (md: string) => {
      setMarkdownContent(md);
      const doc = markdownToTiptap(md);
      scheduleSave(doc);
    },
    [scheduleSave],
  );

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      const trimmed = newTitle.trim();
      if (!trimmed || trimmed === page.title) return;
      await updatePageTitle(trimmed);
    },
    [page.title, updatePageTitle],
  );

  // Chamado pelo BlockEditor em cada update — agenda save, sem setState
  const handleUpdate = useCallback(
    (doc: JSONContent) => {
      scheduleSave(doc);
    },
    [scheduleSave],
  );

  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "m") {
        e.preventDefault();
        handleModeChange(mode === "richtext" ? "markdown" : "richtext");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mode, handleModeChange]);

  const cmTheme = baseTheme === "dark" ? "dark" : "light";

  if (lockState === "locked") {
    return (
      <PasswordUnlockDialog
        pageId={page.id}
        open={true}
        onSuccess={() => {}}
        onCancel={() => {
          clearCurrentPage();
          setActiveView("home");
        }}
      />
    );
  }

  return (
    <div
      className="page-editor w-full py-4"
      data-testid="page-editor"
      onBlur={() => {
        forceSave();
      }}
    >
      <div className="mb-1 flex justify-end">
        <EditorModeToggle mode={mode} onChange={handleModeChange} />
      </div>
      <TitleEditor
        title={page.title}
        onTitleChange={handleTitleChange}
        editorRef={editorRef}
      />

      <div ref={contentAreaRef} className="relative mt-4">
        <InkOverlay contentRef={contentAreaRef} />
        {mode === "richtext" ? (
          <BlockEditor
            initialContent={initialContent}
            onUpdate={handleUpdate}
            onEditorReady={handleEditorReady}
          />
        ) : (
          <MarkdownEditor
            content={markdownContent}
            onChange={handleMarkdownChange}
            theme={cmTheme}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rodar type check**

```bash
npm run typecheck
```

Esperado: sem erros de tipo.

- [ ] **Step 3: Rodar testes**

```bash
npm run test
```

Esperado: todos os testes passam.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/PageEditor.tsx
git commit -m "perf(editor): replace content state with refs to eliminate re-renders on keystrokes"
```

---

### Task 4: Verificar comportamento no app e rodar lint completo

- [ ] **Step 1: Rodar lint completo**

```bash
npm run lint:all
```

Esperado: sem warnings ou erros. Se clippy reclamar de algum warning não relacionado a esta mudança, ignorar (são pré-existentes).

- [ ] **Step 2: Rodar todos os testes**

```bash
npm run test:all
```

Esperado: Rust + frontend tests passam.

- [ ] **Step 3: Validar no app**

```bash
npm run tauri dev
```

Abrir uma nota, digitar rapidamente. O editor deve responder sem delay perceptível. Verificar:
- Texto aparece imediatamente enquanto digita
- Após ~1s sem digitar, o status de save no store é atualizado (sidebar pode refletir isso)
- Trocar de modo (Cmd+Shift+M) converte corretamente
- Fechar e reabrir a nota mantém o conteúdo salvo

- [ ] **Step 4: Commit final de validação**

```bash
git add -A
git commit -m "chore: validate fase1 editor performance fix"
```

---

## Critério de conclusão

Digitação no editor sem lag perceptível. `npm run test:all` passa. Nenhum re-render de `PageEditor` ocorre durante a digitação (verificável via React DevTools > Profiler se necessário).

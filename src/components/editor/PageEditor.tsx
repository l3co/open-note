import { useState, useCallback, useRef, useEffect } from "react";
import type { JSONContent, Editor } from "@tiptap/react";
import type { Page } from "@/types/bindings/Page";
import { TitleEditor } from "@/components/editor/TitleEditor";
import { BlockEditor } from "@/components/editor/BlockEditor";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import {
  EditorModeToggle,
  type EditorMode,
} from "@/components/editor/EditorModeToggle";
import { useAutoSave } from "@/hooks/useAutoSave";
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
  const [content, setContent] = useState<JSONContent | null>(null);
  const [mode, setMode] = useState<EditorMode>("richtext");
  const [markdownContent, setMarkdownContent] = useState("");
  const { updateBlocks, updatePageTitle, lockState, clearCurrentPage } =
    usePageStore();
  const { setActiveView } = useNavigationStore();
  const baseTheme = useUIStore((s) => s.theme.baseTheme);

  const initialContent = blocksToTiptap(page.blocks);

  const handleSave = useCallback(
    async (doc: JSONContent) => {
      const blocks = tiptapToBlocks(doc, page.blocks);
      await updateBlocks(page.id, blocks);
    },
    [page.id, page.blocks, updateBlocks],
  );

  const { forceSave } = useAutoSave({
    content,
    onSave: handleSave,
    delayMs: 1000,
  });

  const handleModeChange = useCallback(
    (newMode: EditorMode) => {
      if (newMode === mode) return;

      if (newMode === "markdown") {
        const currentDoc = content ?? initialContent;
        setMarkdownContent(tiptapToMarkdown(currentDoc));
      } else {
        const doc = markdownToTiptap(markdownContent);
        setContent(doc);
        if (editorRef.current) {
          editorRef.current.commands.setContent(doc);
        }
      }

      setMode(newMode);
    },
    [mode, content, initialContent, markdownContent],
  );

  const handleMarkdownChange = useCallback((md: string) => {
    setMarkdownContent(md);
    const doc = markdownToTiptap(md);
    setContent(doc);
  }, []);

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      const trimmed = newTitle.trim();
      if (!trimmed || trimmed === page.title) return;
      await updatePageTitle(trimmed);
    },
    [page.title, updatePageTitle],
  );

  const handleUpdate = useCallback((doc: JSONContent) => {
    setContent(doc);
  }, []);

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
        onSuccess={() => {
          /* a store já atualiza o currentPage para desbloqueado, o que dispara re-render */
        }}
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

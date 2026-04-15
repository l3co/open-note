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
  const pendingDocRef = useRef<JSONContent | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mode, setMode] = useState<EditorMode>("richtext");
  const [markdownContent, setMarkdownContent] = useState("");

  const updateBlocks = usePageStore((s) => s.updateBlocks);
  const updatePageTitle = usePageStore((s) => s.updatePageTitle);
  const lockState = usePageStore((s) => s.lockState);
  const clearCurrentPage = usePageStore((s) => s.clearCurrentPage);
  const { setActiveView } = useNavigationStore();
  const baseTheme = useUIStore((s) => s.theme.baseTheme);

  // Compute initial content — only passed to BlockEditor as initialContent (not re-rendered on update).
  // The key performance win is that handleUpdate no longer calls setState, so this line
  // running on re-render is harmless (re-renders are now infrequent).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialContent = useMemo(() => blocksToTiptap(page.blocks), [page.id]);

  // Debounced save — stores latest unsaved content and fires after 1000ms
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (pendingDocRef.current) {
        updateBlocks(page.id, tiptapToBlocks(pendingDocRef.current, page.blocks));
        pendingDocRef.current = null;
      }
    }, 1000);
  }, [page.id, page.blocks, updateBlocks]);

  // Immediate save — called on blur
  const forceSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const doc = pendingDocRef.current ?? editorRef.current?.getJSON() ?? null;
    if (doc) {
      updateBlocks(page.id, tiptapToBlocks(doc, page.blocks));
      pendingDocRef.current = null;
    }
  }, [page.id, page.blocks, updateBlocks]);

  // Clean up timer on unmount — also flush any pending content so keystrokes within
  // the last 1000ms aren't lost when the user switches pages.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (pendingDocRef.current) {
        updateBlocks(page.id, tiptapToBlocks(pendingDocRef.current, page.blocks));
        pendingDocRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // empty deps intentional — runs only on unmount; page.id/page.blocks/updateBlocks captured at mount time are correct for the page this instance was created for

  const handleModeChange = useCallback(
    (newMode: EditorMode) => {
      if (newMode === mode) return;

      if (newMode === "markdown") {
        const currentDoc =
          editorRef.current?.getJSON() ?? pendingDocRef.current ?? initialContent;
        setMarkdownContent(tiptapToMarkdown(currentDoc));
      } else {
        const doc = markdownToTiptap(markdownContent);
        pendingDocRef.current = doc;
        if (editorRef.current) {
          editorRef.current.commands.setContent(doc);
        }
      }

      setMode(newMode);
    },
    [mode, initialContent, markdownContent],
  );

  const handleMarkdownChange = useCallback((md: string) => {
    setMarkdownContent(md);
    const doc = markdownToTiptap(md);
    pendingDocRef.current = doc;
    scheduleSave();
  }, [scheduleSave]);

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      const trimmed = newTitle.trim();
      if (!trimmed || trimmed === page.title) return;
      await updatePageTitle(trimmed);
    },
    [page.title, updatePageTitle],
  );

  // handleUpdate stores content in ref and schedules save — does NOT call setState
  const handleUpdate = useCallback(
    (doc: JSONContent) => {
      pendingDocRef.current = doc;
      scheduleSave();
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

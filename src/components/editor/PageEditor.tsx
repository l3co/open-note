import { useState, useCallback, useRef } from "react";
import type { JSONContent, Editor } from "@tiptap/react";
import type { Page } from "@/types/bindings/Page";
import { TitleEditor } from "@/components/editor/TitleEditor";
import { BlockEditor } from "@/components/editor/BlockEditor";
import { useAutoSave } from "@/hooks/useAutoSave";
import { blocksToTiptap, tiptapToBlocks } from "@/lib/serialization";
import { usePageStore } from "@/stores/usePageStore";

interface PageEditorProps {
  page: Page;
}

export function PageEditor({ page }: PageEditorProps) {
  const editorRef = useRef<Editor | null>(null);
  const [content, setContent] = useState<JSONContent | null>(null);
  const { updateBlocks, updatePageTitle } = usePageStore();

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

  return (
    <div
      className="page-editor mx-auto max-w-3xl px-8 py-6"
      onBlur={() => {
        forceSave();
      }}
    >
      <TitleEditor
        title={page.title}
        onTitleChange={handleTitleChange}
        editorRef={editorRef}
      />
      <div className="mt-4">
        <BlockEditor
          initialContent={initialContent}
          onUpdate={handleUpdate}
          onEditorReady={handleEditorReady}
        />
      </div>
    </div>
  );
}

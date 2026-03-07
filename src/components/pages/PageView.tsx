import { useState, useCallback } from "react";
import type { Page } from "@/types/bindings/Page";
import { usePageStore } from "@/stores/usePageStore";
import { TagEditor } from "@/components/pages/TagEditor";
import { FileText } from "lucide-react";

interface PageViewProps {
  page: Page;
}

export function PageView({ page }: PageViewProps) {
  const { updatePageTitle } = usePageStore();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(page.title);

  const handleTitleSubmit = useCallback(async () => {
    setIsEditingTitle(false);
    if (titleDraft.trim() && titleDraft !== page.title) {
      await updatePageTitle(titleDraft.trim());
    } else {
      setTitleDraft(page.title);
    }
  }, [titleDraft, page.title, updatePageTitle]);

  return (
    <div
      className="flex flex-1 flex-col overflow-y-auto"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div className="mx-auto w-full max-w-3xl px-8 py-10">
        {isEditingTitle ? (
          <input
            autoFocus
            className="w-full border-none bg-transparent text-3xl font-bold outline-none"
            style={{ color: "var(--text-primary)" }}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleSubmit();
              if (e.key === "Escape") {
                setTitleDraft(page.title);
                setIsEditingTitle(false);
              }
            }}
          />
        ) : (
          <h1
            className="cursor-text text-3xl font-bold"
            style={{ color: "var(--text-primary)" }}
            onClick={() => {
              setTitleDraft(page.title);
              setIsEditingTitle(true);
            }}
          >
            {page.title}
          </h1>
        )}

        <div className="mt-3">
          <TagEditor pageId={page.id} tags={page.tags} />
        </div>

        <div
          className="mt-2 flex items-center gap-4 text-xs"
          style={{ color: "var(--text-tertiary)" }}
        >
          <span>Criado: {new Date(page.created_at).toLocaleDateString()}</span>
          <span>
            Atualizado: {new Date(page.updated_at).toLocaleDateString()}
          </span>
        </div>

        <div
          className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed py-20"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-tertiary)",
          }}
        >
          <FileText size={32} className="mb-3 opacity-40" />
          <p className="text-sm">Editor será implementado na Fase 04</p>
        </div>
      </div>
    </div>
  );
}

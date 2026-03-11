import React, { Suspense } from "react";
import type { Page } from "@/types/bindings/Page";
import { PageEditor } from "@/components/editor/PageEditor";
import { TagEditor } from "@/components/pages/TagEditor";
import { PdfCanvasPage } from "@/components/pdf/PdfCanvasPage";
import { useTranslation } from "react-i18next";

const CanvasPage = React.lazy(() =>
  import("@/components/canvas/CanvasPage").then((m) => ({
    default: m.CanvasPage,
  })),
);

interface PageViewProps {
  page: Page;
}

export function PageView({ page }: PageViewProps) {
  const { t } = useTranslation();

  if (page.editor_preferences.mode === "canvas") {
    return (
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <span style={{ color: "var(--text-tertiary)" }}>
              {t("common.loading")}
            </span>
          </div>
        }
      >
        <CanvasPage page={page} />
      </Suspense>
    );
  }

  if (page.editor_preferences.mode === "pdf_canvas") {
    return <PdfCanvasPage page={page} />;
  }

  return (
    <div
      className="flex flex-1 flex-col overflow-y-auto"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div className="mx-auto w-10/12 max-w-6xl px-8 py-6">
        <div className="mb-2">
          <TagEditor pageId={page.id} tags={page.tags} />
        </div>

        <div
          className="mb-4 flex items-center gap-4 text-xs"
          style={{ color: "var(--text-tertiary)" }}
        >
          <span>Criado: {new Date(page.created_at).toLocaleDateString()}</span>
          <span>
            Atualizado: {new Date(page.updated_at).toLocaleDateString()}
          </span>
        </div>

        <PageEditor page={page} />
      </div>
    </div>
  );
}

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FolderClosed, X } from "lucide-react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { usePageStore } from "@/stores/usePageStore";

interface MovePageDialogProps {
  pageId: string;
  currentSectionId: string;
  onClose: () => void;
}

export function MovePageDialog({
  pageId,
  currentSectionId,
  onClose,
}: MovePageDialogProps) {
  const { t } = useTranslation();
  const { notebooks, sections, loadSections } = useWorkspaceStore();
  const { movePage } = usePageStore();

  useEffect(() => {
    notebooks.forEach((nb) => {
      if (!sections.has(nb.id)) {
        loadSections(nb.id);
      }
    });
  }, [notebooks, sections, loadSections]);

  const handleMove = async (targetSectionId: string) => {
    if (targetSectionId === currentSectionId) {
      onClose();
      return;
    }
    await movePage(pageId, targetSectionId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-[300px] rounded-xl border p-4 shadow-xl"
        style={{
          backgroundColor: "var(--bg-primary)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {t("page.move")}
          </h3>
          <button
            onClick={onClose}
            className="interactive-ghost flex h-5 w-5 items-center justify-center rounded"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {notebooks.map((nb) => {
            const nbSections = sections.get(nb.id) ?? [];
            if (nbSections.length === 0) return null;
            return (
              <div key={nb.id} className="mb-2">
                <div
                  className="px-2 py-1 text-[11px] font-semibold tracking-wider uppercase"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {nb.name}
                </div>
                {nbSections.map((sec) => (
                  <button
                    key={sec.id}
                    disabled={sec.id === currentSectionId}
                    onClick={() => handleMove(sec.id)}
                    className="interactive-ghost flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-[13px] disabled:cursor-default disabled:opacity-40"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <FolderClosed
                      size={14}
                      style={{ color: "var(--text-secondary)" }}
                    />
                    <span className="flex-1 truncate">{sec.name}</span>
                    {sec.id === currentSectionId && (
                      <span
                        className="text-[11px]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {t("page.current_section")}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            );
          })}

          {notebooks.length === 0 && (
            <p
              className="py-4 text-center text-sm"
              style={{ color: "var(--text-tertiary)" }}
            >
              {t("sidebar.no_notebooks")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

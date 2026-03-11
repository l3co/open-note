import { useState } from "react";
import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "@/stores/useUIStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

export function NewNotebookModal() {
  const { t } = useTranslation();
  const { showNewNotebookModal, closeNewNotebookModal } = useUIStore();
  const { createNotebook } = useWorkspaceStore();
  const [name, setName] = useState("");
  if (!showNewNotebookModal) return null;

  const handleConfirm = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      closeNewNotebookModal();
      return;
    }
    await createNotebook(trimmed);
    closeNewNotebookModal();
  };

  const handleCancel = () => {
    closeNewNotebookModal();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div
        className="w-[340px] rounded-xl border p-5 shadow-xl"
        style={{
          backgroundColor: "var(--bg-primary)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="mb-4 flex items-center gap-2">
          <BookOpen size={18} style={{ color: "var(--accent)" }} />
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {t("notebook.new")}
          </h3>
        </div>
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("notebook.name_placeholder")}
          className="mb-4 w-full rounded-lg border px-3 py-2 text-sm transition-colors outline-none focus:border-[var(--accent)]"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirm();
            if (e.key === "Escape") handleCancel();
          }}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={handleCancel}
            className="interactive-ghost rounded-lg px-4 py-2 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleConfirm}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor: "var(--accent)",
              color: "#fff",
              opacity: name.trim() ? 1 : 0.5,
              cursor: name.trim() ? "pointer" : "default",
            }}
          >
            {t("common.create")}
          </button>
        </div>
      </div>
    </div>
  );
}

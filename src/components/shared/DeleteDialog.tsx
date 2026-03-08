import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";

interface DeleteDialogProps {
  itemType: "notebook" | "section" | "page";
  itemName: string;
  hasChildren?: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function DeleteDialog({
  itemType,
  itemName,
  hasChildren: _hasChildren = false,
  onConfirm,
  onCancel,
}: DeleteDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const { t } = useTranslation();

  const deleteKey =
    itemType === "notebook"
      ? "notebook.delete"
      : itemType === "section"
        ? "section.delete"
        : "page.delete";

  const confirmKey =
    itemType === "notebook"
      ? "notebook.delete_confirm"
      : itemType === "section"
        ? "section.delete_confirm"
        : "page.delete_confirm";

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "var(--overlay)" }}
      onClick={onCancel}
    >
      <div
        className="w-80 rounded-lg border p-4 shadow-lg"
        style={{
          backgroundColor: "var(--bg-primary)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={t(deleteKey)}
      >
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle size={16} style={{ color: "var(--danger)" }} />
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {t(deleteKey)}
          </h2>
        </div>

        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {t(confirmKey, { name: itemName })}
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            data-testid="delete-dialog-cancel"
            className="rounded px-3 py-1.5 text-xs"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--bg-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            data-testid="delete-dialog-confirm"
            className="rounded px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            style={{
              backgroundColor: "var(--danger)",
              color: "#ffffff",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--danger-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--danger)")
            }
          >
            {t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

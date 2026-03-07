import { useState } from "react";
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
  hasChildren = false,
  onConfirm,
  onCancel,
}: DeleteDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const typeLabel =
    itemType === "notebook"
      ? "notebook"
      : itemType === "section"
        ? "seção"
        : "página";

  const childWarning = hasChildren
    ? ` Todo o conteúdo dentro deste ${typeLabel} também será movido para a lixeira.`
    : "";

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
        aria-label={`Excluir ${typeLabel}`}
      >
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle size={16} style={{ color: "var(--danger)" }} />
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Excluir {typeLabel}
          </h2>
        </div>

        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Tem certeza que deseja excluir{" "}
          <strong style={{ color: "var(--text-primary)" }}>{itemName}</strong>?
          {childWarning}
        </p>
        <p
          className="mt-2 text-xs"
          style={{ color: "var(--text-tertiary)" }}
        >
          O item ficará na lixeira por 30 dias.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-xs"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--bg-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
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
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

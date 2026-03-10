import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Dialog, Button } from "@/components/ui";

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
    <Dialog open={true} onClose={onCancel} size="sm" showCloseButton={false}>
      <Dialog.Body>
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500" />
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
      </Dialog.Body>

      <Dialog.Footer>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          data-testid="delete-dialog-cancel"
        >
          {t("common.cancel")}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={handleConfirm}
          loading={submitting}
          data-testid="delete-dialog-confirm"
        >
          {t("common.delete")}
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}

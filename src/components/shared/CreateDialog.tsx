import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, Button } from "@/components/ui";

interface CreateDialogProps {
  title: string;
  placeholder: string;
  onConfirm: (name: string) => Promise<void>;
  onCancel: () => void;
}

export function CreateDialog({
  title,
  placeholder,
  onConfirm,
  onCancel,
}: CreateDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("common.error"));
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(trimmed);
    } catch (e) {
      setError(String(e));
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={true}
      onClose={onCancel}
      title={title}
      data-testid="create-dialog"
    >
      <div className="space-y-4">
        <input
          ref={inputRef}
          data-testid="create-dialog-input"
          className="h-8 w-full rounded border bg-transparent px-3 text-sm outline-none"
          style={{
            borderColor: error ? "var(--danger)" : "var(--border)",
            color: "var(--text-primary)",
          }}
          placeholder={placeholder}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
        />

        {error && (
          <p
            className="text-xs text-[var(--danger)]"
            data-testid="create-dialog-error"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={onCancel}
            data-testid="create-dialog-cancel"
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting}
            data-testid="create-dialog-confirm"
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useTemplateStore } from "@/stores/useTemplateStore";
import type { PageId } from "@/types/bindings/PageId";
import type { TemplateCategory } from "@/types/bindings/TemplateCategory";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  pageId: PageId;
  pageTitleSuggestion: string;
}

export function SaveAsTemplateDialog({
  open,
  onClose,
  pageId,
  pageTitleSuggestion,
}: Props) {
  const { t } = useTranslation();
  const { createFromPage } = useTemplateStore();
  const [name, setName] = useState(pageTitleSuggestion);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("custom");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    setError(null);

    try {
      await createFromPage(pageId, name, description || null, category);
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1500);
    } catch (err: unknown) {
      const msg = String(err);
      if (msg.toLowerCase().includes("image")) {
        setError(t("templates.save_dialog.error_image_blocks"));
      } else if (msg.toLowerCase().includes("protected")) {
        setError(t("templates.errors.protected_page"));
      } else {
        setError(t("templates.errors.save_failed"));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const categories: TemplateCategory[] = [
    "meeting",
    "journal",
    "project",
    "study",
    "custom",
  ];

  return (
    <Dialog open={open} onClose={onClose} size="md">
      <DialogHeader>
        <h2 className="text-lg font-semibold">
          {t("templates.save_dialog.title")}
        </h2>
      </DialogHeader>

      <form onSubmit={handleSave}>
        <DialogBody className="space-y-4">
          {success ? (
            <div className="flex flex-col items-center justify-center space-y-3 py-8 text-center">
              <CheckCircle2 className="animate-in zoom-in h-12 w-12 text-green-500" />
              <p className="font-medium text-[var(--text-primary)]">
                {t("common.success")}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--text-secondary)]">
                  {t("templates.save_dialog.name_label")}
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("templates.save_dialog.name_placeholder")}
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--text-secondary)]">
                  {t("templates.save_dialog.description_label")}
                </label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--text-secondary)]">
                  {t("templates.save_dialog.category_label")}
                </label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as TemplateCategory)
                  }
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {t(`templates.category.${cat}`)}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md bg-red-500/10 p-3 text-sm text-red-500">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          {!success && (
            <>
              <Button
                variant="ghost"
                type="button"
                onClick={onClose}
                disabled={isSaving}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="primary"
                type="submit"
                loading={isSaving}
                disabled={!name.trim()}
              >
                {t("templates.save_dialog.submit")}
              </Button>
            </>
          )}
        </DialogFooter>
      </form>
    </Dialog>
  );
}

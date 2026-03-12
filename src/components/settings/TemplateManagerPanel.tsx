import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTemplateStore } from "@/stores/useTemplateStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/Dialog";
import { Trash2, AlertCircle, LayoutTemplate } from "lucide-react";
import type { TemplateId } from "@/types/bindings/TemplateId";

export function TemplateManagerPanel() {
  const { t } = useTranslation();
  const { userTemplates, loadUserTemplates, deleteUserTemplate } =
    useTemplateStore();
  const { workspace } = useWorkspaceStore();
  const [deletingId, setDeletingId] = useState<TemplateId | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadUserTemplates(workspace?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await deleteUserTemplate(deletingId, workspace?.id);
      setDeletingId(null);
    } catch {
      // erro já tratado no store
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-[var(--text-primary)]">
            {t("templates.title")}
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {t("templates.actions.use_template")}
          </p>
        </div>
      </div>

      {userTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-4 rounded-xl border-2 border-dashed border-[var(--border)] px-4 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-secondary)] text-[var(--text-tertiary)]">
            <LayoutTemplate className="h-6 w-6" />
          </div>
          <div className="max-w-xs space-y-1">
            <p className="font-medium text-[var(--text-primary)]">
              {
                t("templates.errors.load_failed").replace(
                  t("common.error_generic"),
                  "",
                ) /* fallback simples */
              }
              Nenhum template salvo
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Salve qualquer nota como template através do menu de contexto na
              barra lateral para vê-la aqui.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--bg-secondary)] font-medium text-[var(--text-secondary)]">
              <tr>
                <th className="px-4 py-3 font-semibold">
                  {t("templates.save_dialog.name_label")}
                </th>
                <th className="px-4 py-3 font-semibold">
                  {t("templates.save_dialog.category_label")}
                </th>
                <th className="px-4 py-3 font-semibold">Blocos</th>
                <th className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {userTemplates.map((template) => (
                <tr
                  key={template.id}
                  className="group transition-colors hover:bg-[var(--bg-secondary)]/50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded border border-[var(--border)] bg-[var(--bg-secondary)] text-lg">
                        {template.icon || "📄"}
                      </div>
                      <span className="font-medium text-[var(--text-primary)]">
                        {template.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded border border-[var(--border)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[10px] font-bold tracking-wider text-[var(--text-secondary)] uppercase">
                      {t(`templates.category.${template.category}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {template.block_count}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <IconButton
                      icon={<Trash2 size={16} />}
                      onClick={() => setDeletingId(template.id)}
                      variant="ghost"
                      className="text-red-500 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500/10"
                      title={t("common.delete")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog de Confirmação de Deleção */}
      <Dialog
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        title={t("templates.actions.delete_template")}
      >
        <DialogHeader>
          <h2 className="text-lg font-semibold">
            {t("templates.actions.delete_template")}
          </h2>
        </DialogHeader>
        <DialogBody>
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-red-500/10 p-2 text-red-500">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="font-medium text-[var(--text-primary)]">
                Tem certeza que deseja excluir este template?
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Esta ação não pode ser desfeita. A página original não será
                afetada.
              </p>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setDeletingId(null)}
            disabled={isDeleting}
          >
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={isDeleting}>
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

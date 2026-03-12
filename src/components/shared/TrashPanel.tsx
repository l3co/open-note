import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, RotateCcw } from "lucide-react";
import { useUIStore } from "@/stores/useUIStore";
import { Dialog, Button, IconButton } from "@/components/ui";
import * as ipc from "@/lib/ipc";
import type { TrashItem } from "@/types/bindings/TrashItem";

export function TrashPanel() {
  const { showTrashPanel, closeTrashPanel } = useUIStore();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ipc.listTrashItems();
      setItems(data);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (showTrashPanel) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetching on open
      loadItems();
    }
  }, [showTrashPanel, loadItems]);

  const handleRestore = async (id: string) => {
    await ipc.restoreFromTrash(id);
    await loadItems();
  };

  const handlePermanentDelete = async (id: string) => {
    await ipc.permanentlyDelete(id);
    await loadItems();
  };

  const handleEmptyTrash = async () => {
    await ipc.emptyTrash();
    setItems([]);
  };

  return (
    <Dialog
      open={showTrashPanel}
      onClose={closeTrashPanel}
      title={`${t("trash.title")}${items.length > 0 ? ` (${items.length})` : ""}`}
      size="md"
    >
      <div className="absolute top-4 right-14 z-10 flex items-center">
        {items.length > 0 && (
          <Button
            size="sm"
            variant="danger"
            onClick={handleEmptyTrash}
            className="mr-2"
          >
            {t("trash.empty_trash")}
          </Button>
        )}
      </div>

      <Dialog.Body className="h-[400px] p-0">
        {loading ? (
          <div
            className="flex h-full items-center justify-center text-sm"
            style={{ color: "var(--text-tertiary)" }}
          >
            {t("common.loading")}
          </div>
        ) : items.length === 0 ? (
          <div
            className="flex h-full flex-col items-center justify-center gap-3"
            style={{ color: "var(--text-tertiary)" }}
          >
            <Trash2
              size={48}
              style={{ color: "var(--text-tertiary)", opacity: 0.3 }}
            />
            <span className="text-sm">{t("trash.empty")}</span>
          </div>
        ) : (
          <div className="p-2">
            {items.map((item) => (
              <TrashItemRow
                key={item.id}
                item={item}
                onRestore={() => handleRestore(item.id)}
                onDelete={() => handlePermanentDelete(item.id)}
              />
            ))}
          </div>
        )}
      </Dialog.Body>
    </Dialog>
  );
}

function TrashItemRow({
  item,
  onRestore,
  onDelete,
}: {
  item: TrashItem;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const deletedAt = new Date(item.deleted_at);
  const expiresAt = new Date(item.expires_at);
  const now = new Date();
  const daysUntilExpiry = Math.max(
    0,
    Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const daysSinceDelete = Math.floor(
    (now.getTime() - deletedAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  const typeIcon =
    item.item_type === "page"
      ? "📄"
      : item.item_type === "section"
        ? "📑"
        : "📓";

  return (
    <div className="group rounded-lg border-b border-[var(--border-subtle)] p-3 transition-colors hover:bg-[var(--bg-hover)]">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1 cursor-default">
          <div className="flex items-center gap-1.5">
            <span>{typeIcon}</span>
            <span
              className="truncate text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {item.original_title}
            </span>
          </div>
          <p
            className="mt-0.5 truncate text-xs"
            style={{ color: "var(--text-tertiary)" }}
          >
            {item.original_path}
          </p>
          <p
            className="mt-0.5 text-[11px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {t("trash.deleted_days_ago", { days: daysSinceDelete })} •{" "}
            {t("trash.expires_in_days", { days: daysUntilExpiry })}
          </p>
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <IconButton
            size="sm"
            onClick={onRestore}
            icon={<RotateCcw size={13} className="text-[var(--accent)]" />}
            title={t("trash.restore")}
            aria-label={t("trash.restore")}
          />
          <IconButton
            size="sm"
            variant="danger"
            onClick={onDelete}
            icon={<Trash2 size={13} />}
            title={t("trash.delete_permanently")}
            aria-label={t("trash.delete_permanently")}
          />
        </div>
      </div>
    </div>
  );
}

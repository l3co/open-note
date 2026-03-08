import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, RotateCcw, X } from "lucide-react";
import { useUIStore } from "@/stores/useUIStore";
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

  if (!showTrashPanel) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "var(--overlay)" }}
      onClick={closeTrashPanel}
    >
      <div
        className="flex h-[480px] w-[420px] flex-col rounded-lg border shadow-lg"
        style={{
          backgroundColor: "var(--bg-primary)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("trash.title")}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <Trash2 size={16} style={{ color: "var(--text-secondary)" }} />
            <h2
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {t("trash.title")}
            </h2>
            {items.length > 0 && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px]"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-secondary)",
                }}
              >
                {items.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={handleEmptyTrash}
                className="rounded px-2 py-1 text-xs"
                style={{ color: "var(--danger)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "var(--bg-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                {t("trash.empty_trash")}
              </button>
            )}
            <button
              onClick={closeTrashPanel}
              className="flex h-6 w-6 items-center justify-center rounded"
              style={{ color: "var(--text-tertiary)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "var(--bg-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
              aria-label={t("common.close")}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div
              className="flex h-full items-center justify-center text-sm"
              style={{ color: "var(--text-tertiary)" }}
            >
              {t("common.loading")}
            </div>
          ) : items.length === 0 ? (
            <div
              className="flex h-full flex-col items-center justify-center gap-2"
              style={{ color: "var(--text-tertiary)" }}
            >
              <Trash2 size={32} className="opacity-30" />
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
        </div>
      </div>
    </div>
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
    <div
      className="group rounded-lg p-3"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor = "var(--bg-hover)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = "transparent")
      }
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
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
            className="mt-0.5 text-xs"
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
          <button
            onClick={onRestore}
            className="flex h-6 w-6 items-center justify-center rounded"
            style={{ color: "var(--accent)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--accent-subtle)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
            aria-label={t("trash.restore")}
            title={t("trash.restore")}
          >
            <RotateCcw size={13} />
          </button>
          <button
            onClick={onDelete}
            className="flex h-6 w-6 items-center justify-center rounded"
            style={{ color: "var(--danger)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.1)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
            aria-label={t("trash.delete_permanently")}
            title={t("trash.delete_permanently")}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

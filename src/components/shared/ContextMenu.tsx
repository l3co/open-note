import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2, Plus } from "lucide-react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { usePageStore } from "@/stores/usePageStore";
import { useNavigationStore } from "@/stores/useNavigationStore";

interface ContextMenuProps {
  x: number;
  y: number;
  type: "notebook" | "section" | "page";
  id: string;
  notebookId?: string;
  onClose: () => void;
}

export function ContextMenu({
  x,
  y,
  type,
  id,
  notebookId: _notebookId,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const { t } = useTranslation();
  const { renameNotebook, deleteNotebook, createSection, renameSection, deleteSection } =
    useWorkspaceStore();
  const { createPage, deletePage } = usePageStore();
  const { selectPage } = useNavigationStore();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const handleRenameStart = () => {
    setRenaming(true);
    setRenameDraft("");
  };

  const handleRenameSubmit = async () => {
    if (!renameDraft.trim()) {
      setRenaming(false);
      return;
    }
    if (type === "notebook") await renameNotebook(id, renameDraft.trim());
    if (type === "section") await renameSection(id, renameDraft.trim());
    onClose();
  };

  const handleDelete = async () => {
    if (type === "notebook") await deleteNotebook(id);
    if (type === "section") await deleteSection(id);
    if (type === "page") await deletePage(id);
    onClose();
  };

  const handleAddChild = async () => {
    if (type === "notebook") {
      await createSection(id, t("section.new"));
    }
    if (type === "section") {
      const page = await createPage(id, t("page.new"));
      selectPage(page.id);
    }
    onClose();
  };

  if (renaming) {
    return (
      <div
        ref={menuRef}
        className="fixed z-50 rounded-lg border p-2 shadow-lg"
        style={{
          left: x,
          top: y,
          backgroundColor: "var(--bg-primary)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <input
          autoFocus
          className="h-7 w-48 rounded border bg-transparent px-2 text-sm outline-none"
          style={{
            borderColor: "var(--accent)",
            color: "var(--text-primary)",
          }}
          placeholder={t("common.rename")}
          value={renameDraft}
          onChange={(e) => setRenameDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRenameSubmit();
            if (e.key === "Escape") onClose();
          }}
          onBlur={handleRenameSubmit}
        />
      </div>
    );
  }

  const items: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }[] = [];

  if (type === "notebook" || type === "section") {
    items.push({
      icon: <Plus size={14} />,
      label: type === "notebook" ? t("context_menu.new_section") : t("context_menu.new_page"),
      onClick: handleAddChild,
    });
  }

  if (type !== "page") {
    items.push({
      icon: <Pencil size={14} />,
      label: t("context_menu.rename"),
      onClick: handleRenameStart,
    });
  }

  items.push({
    icon: <Trash2 size={14} />,
    label: t("context_menu.delete"),
    onClick: handleDelete,
    danger: true,
  });

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-lg border py-1 shadow-lg"
      style={{
        left: x,
        top: y,
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]"
          style={{
            color: item.danger ? "var(--danger)" : "var(--text-primary)",
          }}
          onClick={item.onClick}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "var(--bg-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

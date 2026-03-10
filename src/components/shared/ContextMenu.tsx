import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2, Plus, FileImage } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { usePageStore } from "@/stores/usePageStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { importPdf, createPdfCanvasPage } from "@/lib/ipc";

interface ContextMenuProps {
  x: number;
  y: number;
  type: "notebook" | "section" | "page";
  id: string;
  name: string;
  notebookId?: string;
  onClose: () => void;
}

export function ContextMenu({
  x,
  y,
  type,
  id,
  name,
  notebookId: _notebookId,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const { t } = useTranslation();
  const {
    renameNotebook,
    deleteNotebook,
    createSection,
    renameSection,
    deleteSection,
  } = useWorkspaceStore();
  const { createPage, deletePage, loadPage } = usePageStore();
  const { selectNotebook, selectSection, selectPage } = useNavigationStore();

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

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (type === "notebook") await deleteNotebook(id);
    if (type === "section") await deleteSection(id);
    if (type === "page") await deletePage(id);
    onClose();
  };

  const handleAddChild = async () => {
    try {
      if (type === "notebook") {
        const section = await createSection(id, t("section.new"));
        selectNotebook(id);
        if (section) {
          selectSection(section.id);
        }
      }
      if (type === "section") {
        const page = await createPage(id, t("page.new"));
        if (_notebookId) selectNotebook(_notebookId);
        selectSection(id);
        selectPage(page.id);
        await loadPage(page.id);
      }
    } catch {
      /* errors are handled by store */
    }
    onClose();
  };

  const handleImportPdf = async () => {
    onClose();
    if (type !== "section") return;
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!selected) return;
      const [, absolutePath, pageCount] = await importPdf(id, selected);
      const fileName =
        (selected as string)
          .split("/")
          .pop()
          ?.replace(/\.pdf$/i, "") ?? t("pdf_canvas.untitled");
      const page = await createPdfCanvasPage(
        id,
        fileName,
        absolutePath,
        pageCount,
      );
      if (_notebookId) selectNotebook(_notebookId);
      selectSection(id);
      selectPage(page.id);
      await loadPage(page.id);
    } catch (err) {
      console.error("[ContextMenu] import PDF failed:", err);
    }
  };

  if (showDeleteConfirm) {
    return (
      <DeleteDialog
        itemType={type}
        itemName={name}
        onConfirm={handleDeleteConfirm}
        onCancel={onClose}
      />
    );
  }

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

  const items: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    danger?: boolean;
  }[] = [];

  if (type === "notebook" || type === "section") {
    items.push({
      icon: <Plus size={14} />,
      label:
        type === "notebook"
          ? t("context_menu.new_section")
          : t("context_menu.new_page"),
      onClick: handleAddChild,
    });
  }

  if (type === "section") {
    items.push({
      icon: <FileImage size={14} />,
      label: t("context_menu.import_pdf"),
      onClick: handleImportPdf,
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
    onClick: handleDeleteClick,
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
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] ${
            item.danger ? "interactive-danger" : "interactive-ghost"
          }`}
          style={{
            color: item.danger ? "var(--danger)" : "var(--text-primary)",
          }}
          onClick={item.onClick}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

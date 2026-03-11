import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pencil,
  Trash2,
  Plus,
  FileImage,
  ArrowRightLeft,
  LayoutDashboard,
  Lock,
  Key,
  LockOpen,
  ShieldCheck,
} from "lucide-react";
import { MovePageDialog } from "./MovePageDialog";
import { open } from "@tauri-apps/plugin-dialog";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { usePageStore } from "@/stores/usePageStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { importPdf, createPdfCanvasPage, createCanvasPage } from "@/lib/ipc";
import { SetPasswordDialog } from "@/components/modals/SetPasswordDialog";
import { ProtectedPagesPanel } from "@/components/modals/ProtectedPagesPanel";

interface ContextMenuProps {
  x: number;
  y: number;
  type: "notebook" | "section" | "page";
  id: string;
  name: string;
  notebookId?: string;
  sectionId?: string;
  onClose: () => void;
}

export function ContextMenu({
  x,
  y,
  type,
  id,
  name,
  notebookId: _notebookId,
  sectionId,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState<{
    open: boolean;
    mode: "set" | "change" | "remove";
  } | null>(null);
  const [showProtectedPages, setShowProtectedPages] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const { t } = useTranslation();
  const {
    renameNotebook,
    deleteNotebook,
    createSection,
    renameSection,
    deleteSection,
  } = useWorkspaceStore();
  const { createPage, deletePage, loadPage, lockPage, pages } = usePageStore();
  const { selectNotebook, selectSection, selectPage } = useNavigationStore();

  const sectionPages = sectionId ? (pages.get(sectionId) ?? []) : [];
  const currentPageSummary = sectionPages.find((p) => p.id === id);
  const isProtected = currentPageSummary?.is_protected ?? false;
  const hasProtectedPages = sectionPages.some((p) => p.is_protected);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        // Se algum diálogo estiver aberto, não fecha o menu (deixa o diálogo gerenciar)
        if (
          !passwordDialog?.open &&
          !showProtectedPages &&
          !showDeleteConfirm &&
          !showMoveDialog
        ) {
          onClose();
        }
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
  }, [
    onClose,
    passwordDialog,
    showProtectedPages,
    showDeleteConfirm,
    showMoveDialog,
  ]);

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

  const handleNewCanvasPage = async () => {
    onClose();
    if (type !== "section") return;
    try {
      const page = await createCanvasPage(id, t("canvas.default_title"));
      if (_notebookId) selectNotebook(_notebookId);
      selectSection(id);
      selectPage(page.id);
      await loadPage(page.id);
    } catch (err) {
      console.error("[ContextMenu] create canvas page failed:", err);
    }
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

  if (passwordDialog?.open) {
    return (
      <SetPasswordDialog
        pageId={id}
        mode={passwordDialog.mode}
        open={true}
        onSuccess={onClose}
        onCancel={onClose}
      />
    );
  }

  if (showProtectedPages && sectionId) {
    return (
      <ProtectedPagesPanel
        summaries={sectionPages}
        open={true}
        onClose={onClose}
        onNavigate={(pageId) => {
          if (_notebookId) selectNotebook(_notebookId);
          selectSection(sectionId);
          selectPage(pageId);
          loadPage(pageId);
          onClose();
        }}
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
    separator?: boolean;
  }[] = [];

  if (type === "page" && sectionId) {
    items.push({
      icon: <ArrowRightLeft size={14} />,
      label: t("page.move"),
      onClick: () => setShowMoveDialog(true),
    });

    // Password actions
    if (!isProtected) {
      items.push({
        icon: <Lock size={14} />,
        label: t("page.contextMenu.protectWithPassword"),
        onClick: () => setPasswordDialog({ open: true, mode: "set" }),
      });
    } else {
      items.push({
        icon: <Lock size={14} />,
        label: t("page.contextMenu.lockNow"),
        onClick: async () => {
          await lockPage(id);
          onClose();
        },
      });
      items.push({
        icon: <Key size={14} />,
        label: t("page.contextMenu.changePassword"),
        onClick: () => setPasswordDialog({ open: true, mode: "change" }),
      });
      items.push({
        icon: <LockOpen size={14} />,
        label: t("page.contextMenu.removePassword"),
        onClick: () => setPasswordDialog({ open: true, mode: "remove" }),
        danger: true,
      });
    }
  }

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
      icon: <LayoutDashboard size={14} />,
      label: t("context_menu.new_canvas_page"),
      onClick: handleNewCanvasPage,
    });
    items.push({
      icon: <FileImage size={14} />,
      label: t("context_menu.import_pdf"),
      onClick: handleImportPdf,
    });

    if (hasProtectedPages) {
      items.push({
        icon: <ShieldCheck size={14} />,
        label: t("section.contextMenu.listProtectedPages"),
        onClick: () => setShowProtectedPages(true),
      });
    }
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

  if (showMoveDialog && sectionId) {
    return (
      <MovePageDialog
        pageId={id}
        currentSectionId={sectionId}
        onClose={onClose}
      />
    );
  }

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

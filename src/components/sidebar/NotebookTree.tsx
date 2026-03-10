import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Book,
  FileText,
  FolderOpen,
  FolderClosed,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { Illustration } from "@/components/shared/Illustration";
import notesStackSvg from "@/assets/illustrations/notes/notes-stack.svg";
import notesListSvg from "@/assets/illustrations/notes/notes-list.svg";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { usePageStore } from "@/stores/usePageStore";
import { ContextMenu } from "@/components/shared/ContextMenu";
import type { Section } from "@/types/bindings/Section";
import type { PageSummary } from "@/types/bindings/PageSummary";
import { clsx } from "clsx";

export function NotebookTree() {
  const { t } = useTranslation();
  const {
    notebooks,
    loadSections,
    sections,
    reorderNotebooks,
    renameNotebook,
    renameSection,
  } = useWorkspaceStore();
  const {
    selectedNotebookId,
    selectedSectionId,
    selectedPageId,
    expandedNotebooks,
    expandedSections,
    selectPage,
    openSectionOverview,
    openNotebookOverview,
  } = useNavigationStore();
  const { loadPages, loadPage, pages } = usePageStore();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: "notebook" | "section" | "page";
    id: string;
    name: string;
    notebookId?: string;
  } | null>(null);

  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItemRef = useRef<{ type: string; id: string } | null>(null);

  const handleNotebookClick = useCallback(
    (id: string) => {
      openNotebookOverview(id);
      loadSections(id);
    },
    [openNotebookOverview, loadSections],
  );

  const handleSectionClick = useCallback(
    (sectionId: string) => {
      openSectionOverview(sectionId);
      loadPages(sectionId);
    },
    [openSectionOverview, loadPages],
  );

  const handlePageClick = useCallback(
    (pageId: string) => {
      selectPage(pageId);
      loadPage(pageId);
    },
    [selectPage, loadPage],
  );

  const handleContextMenu = useCallback(
    (
      e: React.MouseEvent,
      type: "notebook" | "section" | "page",
      id: string,
      name: string,
      notebookId?: string,
    ) => {
      e.preventDefault();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type,
        id,
        name,
        notebookId,
      });
    },
    [],
  );

  const handleDragStart = useCallback((type: string, id: string) => {
    dragItemRef.current = { type, id };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(targetId);
  }, []);

  const handleDrop = useCallback(
    async (targetId: string) => {
      setDragOverId(null);
      const src = dragItemRef.current;
      if (!src || src.id === targetId) return;
      if (src.type === "notebook") {
        const targetIdx = notebooks.findIndex((n) => n.id === targetId);
        if (targetIdx === -1) return;
        const srcNb = notebooks.find((n) => n.id === src.id);
        if (!srcNb) return;
        const without = notebooks.filter((n) => n.id !== src.id);
        without.splice(targetIdx, 0, srcNb);
        const order: [string, number][] = without.map((n, i) => [n.id, i]);
        await reorderNotebooks(order);
      }
      dragItemRef.current = null;
    },
    [notebooks, reorderNotebooks],
  );

  const handleDragEnd = useCallback(() => {
    setDragOverId(null);
    dragItemRef.current = null;
  }, []);

  const handleRename = useCallback(
    async (type: "notebook" | "section", id: string, name: string) => {
      if (type === "notebook") await renameNotebook(id, name);
      else await renameSection(id, name);
    },
    [renameNotebook, renameSection],
  );

  return (
    <div role="tree" aria-label={t("sidebar.notebooks")}>
      {notebooks.map((nb) => {
        const isExpanded = expandedNotebooks.has(nb.id);
        const nbSections = sections.get(nb.id) ?? [];

        return (
          <div key={nb.id} role="treeitem" aria-expanded={isExpanded}>
            <TreeItem
              icon={isExpanded ? <BookOpen size={16} /> : <Book size={16} />}
              label={nb.name}
              isExpanded={isExpanded}
              isSelected={selectedNotebookId === nb.id}
              isDragOver={dragOverId === nb.id}
              depth={0}
              onClick={() => handleNotebookClick(nb.id)}
              onContextMenu={(e) =>
                handleContextMenu(e, "notebook", nb.id, nb.name)
              }
              draggable
              onDragStart={() => handleDragStart("notebook", nb.id)}
              onDragOver={(e) => handleDragOver(e, nb.id)}
              onDrop={() => handleDrop(nb.id)}
              onDragEnd={handleDragEnd}
              onRename={(name) => handleRename("notebook", nb.id, name)}
            />

            {isExpanded && nbSections.length === 0 && (
              <EmptyHint
                src={notesStackSvg}
                label={t("sidebar.no_sections")}
                depth={1}
              />
            )}
            {isExpanded &&
              nbSections.map((sec) => (
                <SectionNode
                  key={sec.id}
                  section={sec}
                  isExpanded={expandedSections.has(sec.id)}
                  isSelected={selectedSectionId === sec.id}
                  selectedPageId={selectedPageId}
                  pages={pages.get(sec.id) ?? []}
                  onSectionClick={() => handleSectionClick(sec.id)}
                  onPageClick={handlePageClick}
                  onContextMenu={handleContextMenu}
                  notebookId={nb.id}
                  onRename={(name) => handleRename("section", sec.id, name)}
                />
              ))}
          </div>
        );
      })}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          id={contextMenu.id}
          name={contextMenu.name}
          notebookId={contextMenu.notebookId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

function SectionNode({
  section,
  isExpanded,
  isSelected,
  selectedPageId,
  pages,
  onSectionClick,
  onPageClick,
  onContextMenu,
  notebookId,
  onRename,
}: {
  section: Section;
  isExpanded: boolean;
  isSelected: boolean;
  selectedPageId: string | null;
  pages: PageSummary[];
  onSectionClick: () => void;
  onPageClick: (id: string) => void;
  onContextMenu: (
    e: React.MouseEvent,
    type: "notebook" | "section" | "page",
    id: string,
    name: string,
    notebookId?: string,
  ) => void;
  notebookId: string;
  onRename: (name: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div role="treeitem" aria-expanded={isExpanded}>
      <TreeItem
        icon={
          isExpanded ? <FolderOpen size={16} /> : <FolderClosed size={16} />
        }
        label={section.name}
        isExpanded={isExpanded}
        isSelected={isSelected}
        depth={1}
        onClick={onSectionClick}
        onContextMenu={(e) =>
          onContextMenu(e, "section", section.id, section.name, notebookId)
        }
        onRename={onRename}
      />

      {isExpanded && pages.length === 0 && (
        <EmptyHint src={notesListSvg} label={t("sidebar.no_pages")} depth={2} />
      )}
      {isExpanded &&
        pages.map((page) => (
          <TreeItem
            key={page.id}
            icon={<FileText size={16} />}
            label={page.title}
            isSelected={selectedPageId === page.id}
            depth={2}
            onClick={() => onPageClick(page.id)}
            onContextMenu={(e) =>
              onContextMenu(e, "page", page.id, page.title, notebookId)
            }
          />
        ))}
    </div>
  );
}

function EmptyHint({
  src,
  label,
  depth,
}: {
  src: string;
  label: string;
  depth: number;
}) {
  return (
    <div
      className="flex items-center gap-2 py-2"
      style={{ paddingLeft: 8 + depth * 16 }}
    >
      <Illustration
        src={src}
        alt=""
        size={20}
        style={{ color: "var(--text-tertiary)", opacity: 0.4 }}
      />
      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </span>
    </div>
  );
}

function TreeItem({
  icon,
  label,
  isExpanded,
  isSelected = false,
  isDragOver = false,
  depth,
  onClick,
  onContextMenu,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onRename,
}: {
  icon: React.ReactNode;
  label: string;
  isExpanded?: boolean;
  isSelected?: boolean;
  isDragOver?: boolean;
  depth: number;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
  onRename?: (name: string) => void;
}) {
  const paddingLeft = 8 + depth * 16;
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(label);

  const handleRenameSubmit = () => {
    setRenaming(false);
    if (draft.trim() && draft !== label && onRename) {
      onRename(draft.trim());
    } else {
      setDraft(label);
    }
  };

  return (
    <div
      className={clsx(
        "interactive-ghost group flex h-8 cursor-pointer items-center gap-2 rounded-md pr-1 text-[14px]",
        (isSelected || isDragOver) &&
          "bg-[var(--accent-subtle)] text-[var(--accent)]",
        !isSelected && !isDragOver && "text-[var(--text-primary)]",
      )}
      style={{ paddingLeft }}
      data-active={isSelected || isDragOver}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDoubleClick={(e) => {
        if (onRename) {
          e.stopPropagation();
          setDraft(label);
          setRenaming(true);
        }
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick();
        if (e.key === "F2" && onRename) {
          e.preventDefault();
          setDraft(label);
          setRenaming(true);
        }
      }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {isExpanded !== undefined ? (
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center"
          style={{ color: "var(--text-tertiary)" }}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      ) : (
        <span className="h-4 w-4 shrink-0" />
      )}
      <span
        className="flex h-4 w-4 items-center justify-center"
        style={{
          color: isSelected ? "var(--accent)" : "var(--text-secondary)",
        }}
      >
        {icon}
      </span>
      {renaming ? (
        <input
          autoFocus
          className="h-5 flex-1 rounded border bg-transparent px-1 text-[14px] outline-none"
          style={{
            borderColor: "var(--accent)",
            color: "var(--text-primary)",
          }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={handleRenameSubmit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") handleRenameSubmit();
            if (e.key === "Escape") {
              setDraft(label);
              setRenaming(false);
            }
          }}
        />
      ) : (
        <span className="flex-1 truncate">{label}</span>
      )}
    </div>
  );
}

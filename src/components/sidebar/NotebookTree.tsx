import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  FileText,
  FolderOpen,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { usePageStore } from "@/stores/usePageStore";
import { ContextMenu } from "@/components/shared/ContextMenu";
import type { Section } from "@/types/bindings/Section";
import type { PageSummary } from "@/types/bindings/PageSummary";

export function NotebookTree() {
  const { t } = useTranslation();
  const {
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
    toggleNotebook,
    selectNotebook,
    toggleSection,
    selectSection,
    selectPage,
  } = useNavigationStore();
  const { loadPages, loadPage, pages } = usePageStore();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: "notebook" | "section" | "page";
    id: string;
    notebookId?: string;
  } | null>(null);

  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItemRef = useRef<{ type: string; id: string } | null>(null);

  const handleNotebookClick = useCallback(
    (id: string) => {
      selectNotebook(id);
      toggleNotebook(id);
      loadSections(id);
    },
    [selectNotebook, toggleNotebook, loadSections],
  );

  const handleSectionClick = useCallback(
    (sectionId: string) => {
      selectSection(sectionId);
      toggleSection(sectionId);
      loadPages(sectionId);
    },
    [selectSection, toggleSection, loadPages],
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
      notebookId?: string,
    ) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, type, id, notebookId });
    },
    [],
  );

  const handleDragStart = useCallback((type: string, id: string) => {
    dragItemRef.current = { type, id };
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      setDragOverId(targetId);
    },
    [],
  );

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
              icon={<BookOpen size={14} />}
              label={nb.name}
              isExpanded={isExpanded}
              isSelected={selectedNotebookId === nb.id}
              isDragOver={dragOverId === nb.id}
              depth={0}
              onClick={() => handleNotebookClick(nb.id)}
              onContextMenu={(e) => handleContextMenu(e, "notebook", nb.id)}
              draggable
              onDragStart={() => handleDragStart("notebook", nb.id)}
              onDragOver={(e) => handleDragOver(e, nb.id)}
              onDrop={() => handleDrop(nb.id)}
              onDragEnd={handleDragEnd}
              onRename={(name) => handleRename("notebook", nb.id, name)}
            />

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
    notebookId?: string,
  ) => void;
  notebookId: string;
  onRename: (name: string) => void;
}) {
  return (
    <div role="treeitem" aria-expanded={isExpanded}>
      <TreeItem
        icon={<FolderOpen size={14} />}
        label={section.name}
        isExpanded={isExpanded}
        isSelected={isSelected}
        depth={1}
        onClick={onSectionClick}
        onContextMenu={(e) =>
          onContextMenu(e, "section", section.id, notebookId)
        }
        onRename={onRename}
      />

      {isExpanded &&
        pages.map((page) => (
          <TreeItem
            key={page.id}
            icon={<FileText size={14} />}
            label={page.title}
            isSelected={selectedPageId === page.id}
            depth={2}
            onClick={() => onPageClick(page.id)}
            onContextMenu={(e) =>
              onContextMenu(e, "page", page.id, notebookId)
            }
          />
        ))}
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

  const bgColor = isDragOver
    ? "var(--accent-subtle)"
    : isSelected
      ? "var(--accent-subtle)"
      : "transparent";

  return (
    <div
      className="group flex h-7 cursor-pointer items-center gap-1.5 rounded-md pr-1 text-[13px]"
      style={{
        paddingLeft,
        backgroundColor: bgColor,
        color: isSelected ? "var(--accent)" : "var(--text-primary)",
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDoubleClick={(e) => {
        if (onRename) {
          e.stopPropagation();
          setDraft(label);
          setRenaming(true);
        }
      }}
      onMouseEnter={(e) => {
        if (!isSelected && !isDragOver)
          e.currentTarget.style.backgroundColor = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected && !isDragOver)
          e.currentTarget.style.backgroundColor = "transparent";
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
      {isExpanded !== undefined && (
        <span
          className="flex h-4 w-4 items-center justify-center"
          style={{ color: "var(--text-tertiary)" }}
        >
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
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
          className="h-5 flex-1 rounded border bg-transparent px-1 text-[13px] outline-none"
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

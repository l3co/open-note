import { useState, useCallback } from "react";
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
  const { notebooks, loadSections, sections } = useWorkspaceStore();
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

  return (
    <div role="tree" aria-label="Navegação de notas">
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
              depth={0}
              onClick={() => handleNotebookClick(nb.id)}
              onContextMenu={(e) => handleContextMenu(e, "notebook", nb.id)}
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
  depth,
  onClick,
  onContextMenu,
}: {
  icon: React.ReactNode;
  label: string;
  isExpanded?: boolean;
  isSelected?: boolean;
  depth: number;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const paddingLeft = 8 + depth * 16;

  return (
    <div
      className="group flex h-7 cursor-pointer items-center gap-1.5 rounded-md pr-1 text-[13px]"
      style={{
        paddingLeft,
        backgroundColor: isSelected ? "var(--accent-subtle)" : "transparent",
        color: isSelected ? "var(--accent)" : "var(--text-primary)",
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={(e) => {
        if (!isSelected)
          e.currentTarget.style.backgroundColor = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected)
          e.currentTarget.style.backgroundColor = "transparent";
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick();
      }}
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
      <span className="flex-1 truncate">{label}</span>
    </div>
  );
}

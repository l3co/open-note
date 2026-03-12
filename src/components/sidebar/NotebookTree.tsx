import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Book,
  FileText,
  FolderOpen,
  FolderClosed,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  FileImage,
  Lock,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Illustration } from "@/components/shared/Illustration";
import notesStackSvg from "@/assets/illustrations/notes/notes-stack.svg";
import notesListSvg from "@/assets/illustrations/notes/notes-list.svg";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { usePageStore } from "@/stores/usePageStore";
import { ContextMenu } from "@/components/shared/ContextMenu";
import { TemplatePickerModal } from "@/components/modals/TemplatePickerModal";
import type { Notebook } from "@/types/bindings/Notebook";
import type { Section } from "@/types/bindings/Section";
import type { PageSummary } from "@/types/bindings/PageSummary";
import type { SectionId } from "@/types/bindings/SectionId";
import { clsx } from "clsx";

type CtxMenuState = {
  x: number;
  y: number;
  type: "notebook" | "section" | "page";
  id: string;
  name: string;
  notebookId?: string;
  sectionId?: string;
} | null;

type ActiveDrag = {
  type: "notebook" | "section" | "page";
  id: string;
  label: string;
} | null;

type OnCtxMenu = (
  e: React.MouseEvent,
  type: "notebook" | "section" | "page",
  id: string,
  name: string,
  notebookId?: string,
  sectionId?: string,
) => void;

export function NotebookTree() {
  const { t } = useTranslation();
  const {
    notebooks,
    loadSections,
    sections,
    reorderNotebooks,
    renameNotebook,
    renameSection,
    moveSection,
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
    toggleNotebook,
    toggleSection,
  } = useNavigationStore();
  const { loadPages, loadPage, pages, movePage } = usePageStore();

  const [contextMenu, setContextMenu] = useState<CtxMenuState>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null);
  const [templatePickerSection, setTemplatePickerSection] =
    useState<SectionId | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleNotebookClick = useCallback(
    (id: string) => {
      if (expandedNotebooks.has(id)) toggleNotebook(id);
      else {
        openNotebookOverview(id);
        loadSections(id);
      }
    },
    [openNotebookOverview, loadSections, toggleNotebook, expandedNotebooks],
  );

  const handleSectionClick = useCallback(
    (sectionId: string) => {
      if (expandedSections.has(sectionId)) toggleSection(sectionId);
      else {
        openSectionOverview(sectionId);
        loadPages(sectionId);
      }
    },
    [openSectionOverview, loadPages, toggleSection, expandedSections],
  );

  const handlePageClick = useCallback(
    (pageId: string) => {
      selectPage(pageId);
      loadPage(pageId);
    },
    [selectPage, loadPage],
  );

  const handleContextMenu = useCallback<OnCtxMenu>(
    (e, type, id, name, notebookId, sectionId) => {
      e.preventDefault();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type,
        id,
        name,
        notebookId,
        sectionId,
      });
    },
    [],
  );

  const handleRename = useCallback(
    async (type: "notebook" | "section", id: string, name: string) => {
      if (type === "notebook") await renameNotebook(id, name);
      else await renameSection(id, name);
    },
    [renameNotebook, renameSection],
  );

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    const d = active.data.current;
    if (d) setActiveDrag(d as ActiveDrag);
  }, []);

  const handleDragEnd = useCallback(
    async ({ active, over }: DragEndEvent) => {
      setActiveDrag(null);
      if (!over || active.id === over.id) return;

      const srcType = active.data.current?.type as string;
      const srcId = active.data.current?.id as string;
      const dstType = over.data.current?.type as string;
      const dstId = over.data.current?.id as string;

      if (srcType === "page" && dstType === "section") {
        await movePage(srcId, dstId);
      } else if (srcType === "section" && dstType === "notebook") {
        await moveSection(srcId, dstId);
      } else if (
        srcType === "notebook" &&
        dstType === "notebook" &&
        srcId !== dstId
      ) {
        const targetIdx = notebooks.findIndex((n) => n.id === dstId);
        if (targetIdx === -1) return;
        const srcNb = notebooks.find((n) => n.id === srcId);
        if (!srcNb) return;
        const without = notebooks.filter((n) => n.id !== srcId);
        without.splice(targetIdx, 0, srcNb);
        await reorderNotebooks(without.map((n, i) => [n.id, i]));
      }
    },
    [notebooks, movePage, moveSection, reorderNotebooks],
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div role="tree" aria-label={t("sidebar.notebooks")}>
        {notebooks.map((nb) => (
          <NotebookRow
            key={nb.id}
            nb={nb}
            isExpanded={expandedNotebooks.has(nb.id)}
            isSelected={selectedNotebookId === nb.id}
            sections={sections.get(nb.id) ?? []}
            expandedSections={expandedSections}
            selectedSectionId={selectedSectionId}
            selectedPageId={selectedPageId}
            pages={pages}
            onNotebookClick={() => handleNotebookClick(nb.id)}
            onSectionClick={handleSectionClick}
            onPageClick={handlePageClick}
            onContextMenu={handleContextMenu}
            onRename={handleRename}
          />
        ))}
      </div>

      <DragOverlay>
        {activeDrag && (
          <div
            className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm shadow-xl"
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--accent)",
              color: "var(--text-primary)",
            }}
          >
            {activeDrag.type === "page" && <FileText size={14} />}
            {activeDrag.type === "section" && <FolderClosed size={14} />}
            {activeDrag.type === "notebook" && <Book size={14} />}
            <span>{activeDrag.label}</span>
          </div>
        )}
      </DragOverlay>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          id={contextMenu.id}
          name={contextMenu.name}
          notebookId={contextMenu.notebookId}
          sectionId={contextMenu.sectionId}
          onClose={() => setContextMenu(null)}
          onSelectTemplate={(sectionId) =>
            setTemplatePickerSection(sectionId as SectionId)
          }
        />
      )}

      {templatePickerSection && (
        <TemplatePickerModal
          open={!!templatePickerSection}
          onClose={() => setTemplatePickerSection(null)}
          sectionId={templatePickerSection}
          onPageCreated={(page) => {
            selectPage(page.id);
            loadPage(page.id);
          }}
        />
      )}
    </DndContext>
  );
}

// ── NotebookRow ───────────────────────────────────────────────────────────────

function NotebookRow({
  nb,
  isExpanded,
  isSelected,
  sections,
  expandedSections,
  selectedSectionId,
  selectedPageId,
  pages,
  onNotebookClick,
  onSectionClick,
  onPageClick,
  onContextMenu,
  onRename,
}: {
  nb: Notebook;
  isExpanded: boolean;
  isSelected: boolean;
  sections: Section[];
  expandedSections: Set<string>;
  selectedSectionId: string | null;
  selectedPageId: string | null;
  pages: Map<string, PageSummary[]>;
  onNotebookClick: () => void;
  onSectionClick: (sectionId: string) => void;
  onPageClick: (pageId: string) => void;
  onContextMenu: OnCtxMenu;
  onRename: (type: "notebook" | "section", id: string, name: string) => void;
}) {
  const { t } = useTranslation();

  const {
    listeners: dragListeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `nb:${nb.id}`,
    data: { type: "notebook", id: nb.id, label: nb.name },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `nb-drop:${nb.id}`,
    data: { type: "notebook", id: nb.id },
  });

  return (
    <div
      ref={setDropRef}
      role="treeitem"
      aria-expanded={isExpanded}
      data-testid="tree-notebook"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <div ref={setDragRef} {...dragListeners} style={{ touchAction: "none" }}>
        <TreeItem
          icon={isExpanded ? <BookOpen size={16} /> : <Book size={16} />}
          label={nb.name}
          isExpanded={isExpanded}
          isSelected={isSelected}
          isDragOver={isOver}
          depth={0}
          onClick={onNotebookClick}
          onContextMenu={(e) => onContextMenu(e, "notebook", nb.id, nb.name)}
          onRename={(name) => onRename("notebook", nb.id, name)}
        />
      </div>

      {isExpanded && sections.length === 0 && (
        <EmptyHint
          src={notesStackSvg}
          label={t("sidebar.no_sections")}
          depth={1}
        />
      )}
      {isExpanded &&
        sections.map((sec) => (
          <SectionNode
            key={sec.id}
            section={sec}
            isExpanded={expandedSections.has(sec.id)}
            isSelected={selectedSectionId === sec.id}
            selectedPageId={selectedPageId}
            pages={pages.get(sec.id) ?? []}
            onSectionClick={() => onSectionClick(sec.id)}
            onPageClick={onPageClick}
            onContextMenu={onContextMenu}
            notebookId={nb.id}
            onRename={(name) => onRename("section", sec.id, name)}
          />
        ))}
    </div>
  );
}

// ── SectionNode ───────────────────────────────────────────────────────────────

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
  onContextMenu: OnCtxMenu;
  notebookId: string;
  onRename: (name: string) => void;
}) {
  const { t } = useTranslation();

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `sec-drop:${section.id}`,
    data: { type: "section", id: section.id },
  });

  const {
    listeners: dragListeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `sec:${section.id}`,
    data: { type: "section", id: section.id, label: section.name },
  });

  return (
    <div
      ref={setDropRef}
      role="treeitem"
      aria-expanded={isExpanded}
      data-testid="tree-section"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <div ref={setDragRef} {...dragListeners} style={{ touchAction: "none" }}>
        <TreeItem
          icon={
            isExpanded ? <FolderOpen size={16} /> : <FolderClosed size={16} />
          }
          label={section.name}
          isExpanded={isExpanded}
          isSelected={isSelected}
          isDragOver={isOver}
          depth={1}
          onClick={onSectionClick}
          onContextMenu={(e) =>
            onContextMenu(e, "section", section.id, section.name, notebookId)
          }
          onRename={onRename}
        />
      </div>

      {isExpanded && pages.length === 0 && (
        <EmptyHint src={notesListSvg} label={t("sidebar.no_pages")} depth={2} />
      )}
      {isExpanded &&
        pages.map((page) => (
          <PageRow
            key={page.id}
            page={page}
            isSelected={selectedPageId === page.id}
            notebookId={notebookId}
            sectionId={section.id}
            onClick={() => onPageClick(page.id)}
            onContextMenu={onContextMenu}
          />
        ))}
    </div>
  );
}

// ── PageRow ───────────────────────────────────────────────────────────────────

function PageRow({
  page,
  isSelected,
  notebookId,
  sectionId,
  onClick,
  onContextMenu,
}: {
  page: PageSummary;
  isSelected: boolean;
  notebookId: string;
  sectionId: string;
  onClick: () => void;
  onContextMenu: OnCtxMenu;
}) {
  const {
    listeners: dragListeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id: `pg:${page.id}`,
    data: { type: "page", id: page.id, label: page.title },
  });

  const getPageIcon = () => {
    if (page.is_protected) return <Lock size={16} />;
    if (page.mode === "canvas") return <LayoutDashboard size={16} />;
    if (page.mode === "pdf_canvas") return <FileImage size={16} />;
    return <FileText size={16} />;
  };

  return (
    <div
      ref={setNodeRef}
      {...dragListeners}
      data-testid="tree-page"
      style={{ touchAction: "none", opacity: isDragging ? 0.4 : 1 }}
    >
      <TreeItem
        icon={getPageIcon()}
        label={page.title}
        isSelected={isSelected}
        depth={2}
        onClick={onClick}
        onContextMenu={(e) =>
          onContextMenu(e, "page", page.id, page.title, notebookId, sectionId)
        }
        labelClassName={clsx(
          page.is_protected && "italic text-muted-foreground",
        )}
      />
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
  labelClassName,
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
  labelClassName?: string;
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
      onDragStart={
        draggable && onDragStart
          ? (e: React.DragEvent) => {
              e.dataTransfer.setData("text/plain", "");
              e.dataTransfer.effectAllowed = "move";
              onDragStart();
            }
          : undefined
      }
      onDragOver={onDragOver}
      onDrop={
        onDrop
          ? (e: React.DragEvent) => {
              e.stopPropagation();
              onDrop();
            }
          : undefined
      }
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
        <span className={clsx("flex-1 truncate", labelClassName)}>{label}</span>
      )}
    </div>
  );
}

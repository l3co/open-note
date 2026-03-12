import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutGrid,
  List,
  FolderOpen,
  Clock,
  FilePlus,
  FolderPlus,
} from "lucide-react";
import { InteractiveCard } from "@/components/ui";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { usePageStore } from "@/stores/usePageStore";
import type { Section } from "@/types/bindings/Section";

type Layout = "grid" | "list";

export function NotebookOverview() {
  const { t } = useTranslation();
  const { selectedNotebookId, openSectionOverview } = useNavigationStore();
  const { notebooks, sections, loadSections, createSection } =
    useWorkspaceStore();
  const pages = usePageStore((s) => s.pages);

  const [layout, setLayout] = useState<Layout>(() => {
    return (
      (localStorage.getItem("notebook-overview-layout") as Layout) ?? "grid"
    );
  });
  const [creating, setCreating] = useState(false);

  const notebook = notebooks.find((n) => n.id === selectedNotebookId);
  const notebookSections: Section[] =
    sections.get(selectedNotebookId ?? "") ?? [];

  useEffect(() => {
    if (selectedNotebookId) {
      loadSections(selectedNotebookId);
    }
  }, [selectedNotebookId, loadSections]);

  const handleLayoutChange = (l: Layout) => {
    setLayout(l);
    localStorage.setItem("notebook-overview-layout", l);
  };

  const handleSectionClick = (section: Section) => {
    openSectionOverview(section.id);
    usePageStore.getState().loadPages(section.id);
  };

  const handleNewSection = async () => {
    if (!selectedNotebookId || creating) return;
    setCreating(true);
    try {
      await createSection(
        selectedNotebookId,
        t("notebook_overview.new_section_default"),
      );
    } finally {
      setCreating(false);
    }
  };

  if (!selectedNotebookId || !notebook) return null;

  return (
    <div
      className="flex flex-1 flex-col overflow-hidden"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <h1
            className="text-xl font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {notebook.name}
          </h1>
          <span
            className="rounded-full px-2 py-0.5 text-xs"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-tertiary)",
            }}
          >
            {notebookSections.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* New section button */}
          <button
            onClick={handleNewSection}
            disabled={creating}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-fg)",
            }}
          >
            <FolderPlus size={14} />
            {t("notebook_overview.new_section")}
          </button>

          {/* Layout toggle */}
          <div
            className="flex items-center rounded-md p-0.5"
            style={{ backgroundColor: "var(--bg-tertiary)" }}
          >
            <LayoutToggleBtn
              active={layout === "grid"}
              onClick={() => handleLayoutChange("grid")}
              title={t("notebook_overview.grid_view")}
            >
              <LayoutGrid size={15} />
            </LayoutToggleBtn>
            <LayoutToggleBtn
              active={layout === "list"}
              onClick={() => handleLayoutChange("list")}
              title={t("notebook_overview.list_view")}
            >
              <List size={15} />
            </LayoutToggleBtn>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {notebookSections.length === 0 ? (
          <EmptyState onNewSection={handleNewSection} />
        ) : layout === "grid" ? (
          <GridView
            sections={notebookSections}
            pages={pages}
            onSectionClick={handleSectionClick}
          />
        ) : (
          <ListView
            sections={notebookSections}
            pages={pages}
            onSectionClick={handleSectionClick}
          />
        )}
      </div>
    </div>
  );
}

// ─── Grid view ────────────────────────────────────────────────────────────────

function GridView({
  sections,
  pages,
  onSectionClick,
}: {
  sections: Section[];
  pages: Map<string, import("@/types/bindings/PageSummary").PageSummary[]>;
  onSectionClick: (s: Section) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {sections.map((section) => (
        <GridCard
          key={section.id}
          section={section}
          pageCount={pages.get(section.id)?.length}
          onClick={() => onSectionClick(section)}
        />
      ))}
    </div>
  );
}

function GridCard({
  section,
  pageCount,
  onClick,
}: {
  section: Section;
  pageCount: number | undefined;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const accentColor = section.color?.hex ?? "var(--accent)";

  return (
    <InteractiveCard
      onClick={onClick}
      accentColor={accentColor}
      accentBar
      className="p-4"
    >
      {/* Icon area */}
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${accentColor}20` }}
      >
        <FolderOpen size={20} style={{ color: accentColor }} />
      </div>

      {/* Name */}
      <span
        className="mb-2 line-clamp-2 text-sm leading-snug font-medium"
        style={{ color: "var(--text-primary)" }}
      >
        {section.name}
      </span>

      {/* Page count + date */}
      <div
        className="mb-1 flex items-center gap-1 text-[11px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {pageCount !== undefined && (
          <span>
            {pageCount} {t("notebook_overview.pages", { count: pageCount })}
          </span>
        )}
      </div>

      <div
        className="flex items-center gap-1 text-[11px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        <Clock size={10} />
        <span>{formatDate(section.updated_at)}</span>
      </div>
    </InteractiveCard>
  );
}

// ─── List view ────────────────────────────────────────────────────────────────

function ListView({
  sections,
  pages,
  onSectionClick,
}: {
  sections: Section[];
  pages: Map<string, import("@/types/bindings/PageSummary").PageSummary[]>;
  onSectionClick: (s: Section) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {sections.map((section) => (
        <ListRow
          key={section.id}
          section={section}
          pageCount={pages.get(section.id)?.length}
          onClick={() => onSectionClick(section)}
        />
      ))}
    </div>
  );
}

function ListRow({
  section,
  pageCount,
  onClick,
}: {
  section: Section;
  pageCount: number | undefined;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const accentColor = section.color?.hex ?? "var(--accent)";

  return (
    <InteractiveCard
      onClick={onClick}
      accentColor={accentColor}
      className="flex-row items-center gap-3 px-3 py-2.5"
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${accentColor}20` }}
      >
        <FolderOpen size={15} style={{ color: accentColor }} />
      </div>

      <div className="min-w-0 flex-1">
        <span
          className="block truncate text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {section.name}
        </span>
        <div
          className="mt-0.5 flex items-center gap-2 text-[11px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {pageCount !== undefined && (
            <span>
              {pageCount} {t("notebook_overview.pages", { count: pageCount })}
            </span>
          )}
          {pageCount !== undefined && <span>·</span>}
          <span>{formatDate(section.updated_at)}</span>
        </div>
      </div>

      <span
        className="shrink-0 text-[11px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {formatDateShort(section.created_at)}
      </span>
    </InteractiveCard>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onNewSection }: { onNewSection: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: "var(--bg-tertiary)" }}
      >
        <FolderOpen size={28} style={{ color: "var(--text-tertiary)" }} />
      </div>
      <p
        className="mb-1 text-sm font-medium"
        style={{ color: "var(--text-primary)" }}
      >
        {t("notebook_overview.empty_title")}
      </p>
      <p className="mb-4 text-xs" style={{ color: "var(--text-tertiary)" }}>
        {t("notebook_overview.empty_description")}
      </p>
      <button
        onClick={onNewSection}
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium"
        style={{ backgroundColor: "var(--accent)", color: "var(--accent-fg)" }}
      >
        <FilePlus size={14} />
        {t("notebook_overview.new_section")}
      </button>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function LayoutToggleBtn({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded transition-colors"
      style={{
        backgroundColor: active ? "var(--bg-primary)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-tertiary)",
        boxShadow: active ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
      }}
    >
      {children}
    </button>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `${days}d atrás`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

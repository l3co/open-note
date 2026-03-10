import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import {
  LayoutGrid,
  List,
  FileText,
  Clock,
  Tag,
  FilePlus,
  FileImage,
} from "lucide-react";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { usePageStore } from "@/stores/usePageStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { importPdf, createPdfCanvasPage } from "@/lib/ipc";
import type { PageSummary } from "@/types/bindings/PageSummary";

type Layout = "grid" | "list";

const PAGES_PER_PAGE = 24;

export function SectionOverview() {
  const { t } = useTranslation();
  const { selectedSectionId, selectPage } = useNavigationStore();
  const { pages, loadPages, loadPage, createPage } = usePageStore();
  const { sections } = useWorkspaceStore();

  const [layout, setLayout] = useState<Layout>(() => {
    return (
      (localStorage.getItem("section-overview-layout") as Layout) ?? "grid"
    );
  });
  const [currentPaginaPage, setCurrentPaginaPage] = useState(1);

  const sectionPages: PageSummary[] = pages.get(selectedSectionId ?? "") ?? [];

  let sectionName = "";
  if (selectedSectionId) {
    for (const sectionList of sections.values()) {
      const found = sectionList.find((s) => s.id === selectedSectionId);
      if (found) {
        sectionName = found.name;
        break;
      }
    }
  }

  useEffect(() => {
    if (selectedSectionId) {
      loadPages(selectedSectionId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentPaginaPage(1);
    }
  }, [selectedSectionId, loadPages]);

  const handleLayoutChange = (l: Layout) => {
    setLayout(l);
    localStorage.setItem("section-overview-layout", l);
  };

  const handlePageClick = (pageId: string) => {
    selectPage(pageId);
    loadPage(pageId);
  };

  const handleNewPage = async () => {
    if (!selectedSectionId) return;
    const page = await createPage(
      selectedSectionId,
      t("section_overview.untitled"),
    );
    selectPage(page.id);
    loadPage(page.id);
  };

  const handleImportPdf = async () => {
    if (!selectedSectionId) return;
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!selected) return;
      const [, absolutePath, pageCount] = await importPdf(
        selectedSectionId,
        selected as string,
      );
      const fileName =
        (selected as string)
          .split("/")
          .pop()
          ?.replace(/\.pdf$/i, "") ?? t("pdf_canvas.untitled");
      const page = await createPdfCanvasPage(
        selectedSectionId,
        fileName,
        absolutePath,
        pageCount,
      );
      selectPage(page.id);
      await loadPage(page.id);
    } catch (err) {
      console.error("[SectionOverview] import PDF failed:", err);
    }
  };

  const totalPages = Math.ceil(sectionPages.length / PAGES_PER_PAGE);
  const start = (currentPaginaPage - 1) * PAGES_PER_PAGE;
  const visiblePages = sectionPages.slice(start, start + PAGES_PER_PAGE);

  if (!selectedSectionId) return null;

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
            {sectionName}
          </h1>
          <span
            className="rounded-full px-2 py-0.5 text-xs"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-tertiary)",
            }}
          >
            {sectionPages.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Import PDF button */}
          <button
            onClick={handleImportPdf}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
            }}
          >
            <FileImage size={14} />
            {t("section_overview.import_pdf")}
          </button>

          {/* New page button */}
          <button
            onClick={handleNewPage}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-fg)",
            }}
          >
            <FilePlus size={14} />
            {t("section_overview.new_page")}
          </button>

          {/* Layout toggle */}
          <div
            className="flex items-center rounded-md p-0.5"
            style={{ backgroundColor: "var(--bg-tertiary)" }}
          >
            <LayoutToggleBtn
              active={layout === "grid"}
              onClick={() => handleLayoutChange("grid")}
              title={t("section_overview.grid_view")}
            >
              <LayoutGrid size={15} />
            </LayoutToggleBtn>
            <LayoutToggleBtn
              active={layout === "list"}
              onClick={() => handleLayoutChange("list")}
              title={t("section_overview.list_view")}
            >
              <List size={15} />
            </LayoutToggleBtn>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {sectionPages.length === 0 ? (
          <EmptyState onNewPage={handleNewPage} />
        ) : layout === "grid" ? (
          <GridView pages={visiblePages} onPageClick={handlePageClick} />
        ) : (
          <ListView pages={visiblePages} onPageClick={handlePageClick} />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-center gap-2 border-t px-6 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <PaginationBar
            current={currentPaginaPage}
            total={totalPages}
            onChange={setCurrentPaginaPage}
          />
        </div>
      )}
    </div>
  );
}

// ─── Grid view ───────────────────────────────────────────────────────────────

function GridView({
  pages,
  onPageClick,
}: {
  pages: PageSummary[];
  onPageClick: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {pages.map((page) => (
        <GridCard
          key={page.id}
          page={page}
          onClick={() => onPageClick(page.id)}
        />
      ))}
    </div>
  );
}

function GridCard({
  page,
  onClick,
}: {
  page: PageSummary;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      className="group flex flex-col rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      {/* Icon area */}
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: "var(--accent-subtle)" }}
      >
        <FileText size={20} style={{ color: "var(--accent)" }} />
      </div>

      {/* Title */}
      <span
        className="mb-2 line-clamp-2 text-sm leading-snug font-medium"
        style={{ color: "var(--text-primary)" }}
      >
        {page.title || t("section_overview.untitled")}
      </span>

      {/* Dates */}
      <div
        className="mb-3 flex items-center gap-1 text-[11px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        <Clock size={10} />
        <span>{formatDate(page.updated_at)}</span>
      </div>

      {/* Tags */}
      {page.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {page.tags.slice(0, 3).map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
          {page.tags.length > 3 && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px]"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-tertiary)",
              }}
            >
              +{page.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// ─── List view ────────────────────────────────────────────────────────────────

function ListView({
  pages,
  onPageClick,
}: {
  pages: PageSummary[];
  onPageClick: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {pages.map((page) => (
        <ListRow
          key={page.id}
          page={page}
          onClick={() => onPageClick(page.id)}
        />
      ))}
    </div>
  );
}

function ListRow({
  page,
  onClick,
}: {
  page: PageSummary;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-secondary)]"
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: "var(--accent-subtle)" }}
      >
        <FileText size={15} style={{ color: "var(--accent)" }} />
      </div>

      <div className="min-w-0 flex-1">
        <span
          className="block truncate text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {page.title || t("section_overview.untitled")}
        </span>
        <div
          className="mt-0.5 flex items-center gap-2 text-[11px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          <span>{formatDate(page.updated_at)}</span>
          {page.tags.length > 0 && (
            <>
              <span>·</span>
              <div className="flex items-center gap-1">
                <Tag size={10} />
                <span>{page.tags.slice(0, 2).join(", ")}</span>
                {page.tags.length > 2 && <span>+{page.tags.length - 2}</span>}
              </div>
            </>
          )}
        </div>
      </div>

      <span
        className="shrink-0 text-[11px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {formatDateShort(page.created_at)}
      </span>
    </button>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onNewPage }: { onNewPage: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: "var(--bg-tertiary)" }}
      >
        <FileText size={28} style={{ color: "var(--text-tertiary)" }} />
      </div>
      <p
        className="mb-1 text-sm font-medium"
        style={{ color: "var(--text-primary)" }}
      >
        {t("section_overview.empty_title")}
      </p>
      <p className="mb-4 text-xs" style={{ color: "var(--text-tertiary)" }}>
        {t("section_overview.empty_description")}
      </p>
      <button
        onClick={onNewPage}
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium"
        style={{ backgroundColor: "var(--accent)", color: "var(--accent-fg)" }}
      >
        <FilePlus size={14} />
        {t("section_overview.new_page")}
      </button>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function PaginationBar({
  current,
  total,
  onChange,
}: {
  current: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <PaginationBtn
        onClick={() => onChange(current - 1)}
        disabled={current <= 1}
      >
        ←
      </PaginationBtn>

      {Array.from({ length: total }, (_, i) => i + 1).map((p) => (
        <PaginationBtn
          key={p}
          onClick={() => onChange(p)}
          active={p === current}
        >
          {p}
        </PaginationBtn>
      ))}

      <PaginationBtn
        onClick={() => onChange(current + 1)}
        disabled={current >= total}
      >
        →
      </PaginationBtn>
    </div>
  );
}

function PaginationBtn({
  children,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 min-w-[32px] items-center justify-center rounded-md px-2 text-xs font-medium transition-colors disabled:opacity-40"
      style={{
        backgroundColor: active ? "var(--accent)" : "var(--bg-secondary)",
        color: active ? "var(--accent-fg)" : "var(--text-secondary)",
        border: `1px solid ${active ? "transparent" : "var(--border)"}`,
      }}
    >
      {children}
    </button>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function TagChip({ tag }: { tag: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        backgroundColor: "var(--accent-subtle)",
        color: "var(--accent)",
      }}
    >
      {tag}
    </span>
  );
}

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

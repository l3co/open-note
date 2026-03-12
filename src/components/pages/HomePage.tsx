import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Clock,
  FileText,
  Plus,
  BookOpen,
  Search,
  Settings,
  Shuffle,
  LayoutDashboard,
  FileImage,
} from "lucide-react";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { usePageStore } from "@/stores/usePageStore";
import { useUIStore } from "@/stores/useUIStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { useMultiWorkspaceStore } from "@/stores/useMultiWorkspaceStore";
import { BackgroundPattern } from "@/components/shared/BackgroundPattern";
import { Button, InteractiveCard } from "@/components/ui";
import { getRandomPages, ensureQuickNotes } from "@/lib/ipc";
import type { PageSummary } from "@/types/bindings/PageSummary";
import logoSrc from "@/assets/logo.png";

function getGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "home.greeting_morning";
  if (hour < 18) return "home.greeting_afternoon";
  return "home.greeting_evening";
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  if (days === 1) return "ontem";
  if (days < 7) return `${days}d atrás`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function pageModeIcon(mode: string, size = 16) {
  if (mode === "canvas")
    return <LayoutDashboard size={size} style={{ color: "var(--accent)" }} />;
  if (mode === "pdf_canvas")
    return <FileImage size={size} style={{ color: "var(--accent)" }} />;
  return <FileText size={size} style={{ color: "var(--accent)" }} />;
}

export function HomePage() {
  const { t } = useTranslation();
  const { history, selectPage } = useNavigationStore();
  const { loadPage, pages, createPage } = usePageStore();
  const { openQuickOpen, openSettings } = useUIStore();
  const { createNotebook, sections, notebooks } = useWorkspaceStore();
  const quickNotesSectionId = useMultiWorkspaceStore(
    (s) => s.focusedSlice()?.workspace.settings?.quick_notes_section_id ?? null,
  );

  const [showNotebookModal, setShowNotebookModal] = useState(false);
  const [notebookName, setNotebookName] = useState("");
  const notebookInputRef = useRef<HTMLInputElement>(null);
  const [spotlight, setSpotlight] = useState<PageSummary | null>(null);

  useEffect(() => {
    if (showNotebookModal) {
      setTimeout(() => notebookInputRef.current?.focus(), 30);
    }
  }, [showNotebookModal]);

  const allPages: PageSummary[] = [];
  pages.forEach((sectionPages) => {
    sectionPages.forEach((p) => allPages.push(p));
  });

  const recentPageIds = [...history]
    .reverse()
    .filter((id, idx, arr) => arr.indexOf(id) === idx)
    .slice(0, 5);
  const recentPages = recentPageIds
    .map((id) => allPages.find((p) => p.id === id))
    .filter(Boolean) as PageSummary[];

  // Build section → notebook name map for path display
  const sectionPathMap = new Map<string, string>();
  notebooks.forEach((nb) => {
    const secs = sections.get(nb.id) ?? [];
    secs.forEach((s) => sectionPathMap.set(s.id, `${nb.name} / ${s.name}`));
  });

  // Find which section a page belongs to
  const findSectionPath = (pageId: string): string => {
    for (const [sectionId, sectionPages] of pages) {
      if (sectionPages.some((p) => p.id === pageId)) {
        return sectionPathMap.get(sectionId) ?? "";
      }
    }
    return "";
  };

  useEffect(() => {
    let cancelled = false;
    getRandomPages(1, [])
      .then((results) => {
        if (!cancelled) setSpotlight(results[0] ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []); // load spotlight once on mount

  const handleNewNotebook = () => {
    setNotebookName("");
    setShowNotebookModal(true);
  };

  const handleNotebookConfirm = async () => {
    if (!notebookName.trim()) {
      setShowNotebookModal(false);
      return;
    }
    await createNotebook(notebookName.trim());
    setNotebookName("");
    setShowNotebookModal(false);
  };

  const handleNotebookCancel = () => {
    setNotebookName("");
    setShowNotebookModal(false);
  };

  const handleNewPage = async () => {
    try {
      const sectionId = quickNotesSectionId ?? (await ensureQuickNotes());
      const page = await createPage(sectionId, t("page.new"));
      selectPage(page.id);
      await loadPage(page.id);
    } catch {
      openQuickOpen();
    }
  };

  const handlePageClick = (id: string) => {
    selectPage(id);
    loadPage(id);
  };

  return (
    <div
      className="relative flex flex-1 overflow-y-auto"
      style={{ backgroundColor: "var(--bg-primary)" }}
      data-testid="home-page"
    >
      <BackgroundPattern />
      <div className="relative z-10 mx-auto w-full max-w-2xl px-8 py-12">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <img src={logoSrc} alt="Open Note" className="h-10 w-10" />
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {t(getGreetingKey())}
          </h1>
        </div>

        {/* Quick actions row */}
        <div className="mb-8 flex items-center gap-2">
          <button
            onClick={handleNewPage}
            className="interactive-accent flex h-8 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold whitespace-nowrap"
          >
            <Plus size={15} />
            {t("home.action_new_page")}
          </button>
          <Button
            variant="secondary"
            icon={<Search size={15} />}
            shortcut="⌘K"
            onClick={openQuickOpen}
            className="border border-[var(--border)]"
          >
            {t("home.action_search")}
          </Button>
          <Button
            variant="secondary"
            icon={<BookOpen size={15} />}
            onClick={handleNewNotebook}
            className="border border-[var(--border)]"
          >
            {t("home.action_new_notebook")}
          </Button>
          <Button
            variant="secondary"
            icon={<Settings size={15} />}
            shortcut="⌘,"
            onClick={openSettings}
            className="border border-[var(--border)]"
          >
            {t("home.action_settings")}
          </Button>
        </div>

        {/* Feed temporal — Recent pages */}
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Clock size={13} style={{ color: "var(--text-tertiary)" }} />
            <h2
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: "var(--text-tertiary)" }}
            >
              {t("home.recent_pages")}
            </h2>
          </div>

          {recentPages.length > 0 ? (
            <div className="flex flex-col gap-2">
              {recentPages.map((page) => {
                const path = findSectionPath(page.id);
                return (
                  <InteractiveCard
                    key={page.id}
                    onClick={() => handlePageClick(page.id)}
                    className="flex-row items-start gap-3 px-4 py-3"
                  >
                    {/* Mode icon */}
                    <div
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: "var(--accent-subtle)" }}
                    >
                      {pageModeIcon(page.mode)}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <span
                        className="block truncate text-sm font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {page.title || t("section_overview.untitled")}
                      </span>
                      {page.preview && (
                        <p
                          className="mt-0.5 line-clamp-1 text-[12px]"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {page.preview}
                        </p>
                      )}
                      {path && (
                        <span
                          className="mt-1 block truncate text-[11px]"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {path}
                        </span>
                      )}
                    </div>

                    {/* Relative date */}
                    <span
                      className="shrink-0 text-[11px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {formatRelativeDate(page.updated_at)}
                    </span>
                  </InteractiveCard>
                );
              })}
            </div>
          ) : (
            <div
              className="rounded-xl border py-8 text-center"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-tertiary)",
              }}
            >
              <FileText size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t("home.no_recent")}</p>
            </div>
          )}
        </section>

        {/* Random Note Spotlight */}
        {spotlight && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shuffle size={13} style={{ color: "var(--text-tertiary)" }} />
                <h2
                  className="text-xs font-semibold tracking-widest uppercase"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {t("home.random_note")}
                </h2>
              </div>
              <button
                onClick={() => {
                  const exclude = spotlight ? [spotlight.id] : [];
                  getRandomPages(1, exclude)
                    .then((r) => setSpotlight(r[0] ?? null))
                    .catch(() => {});
                }}
                className="interactive-ghost rounded-md px-2 py-1 text-[11px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {t("home.shuffle")}
              </button>
            </div>

            <InteractiveCard
              onClick={() => handlePageClick(spotlight.id)}
              accentBar
              className="px-5 py-4"
            >
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "var(--accent-subtle)" }}
                >
                  {pageModeIcon(spotlight.mode, 18)}
                </div>
                <div className="min-w-0 flex-1">
                  <span
                    className="block truncate text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {spotlight.title || t("section_overview.untitled")}
                  </span>
                  {spotlight.preview && (
                    <p
                      className="mt-1 line-clamp-2 text-[13px] leading-relaxed"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {spotlight.preview}
                    </p>
                  )}
                  <span
                    className="mt-2 block text-[11px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {formatRelativeDate(spotlight.updated_at)}
                  </span>
                </div>
              </div>
            </InteractiveCard>
          </section>
        )}
      </div>

      {showNotebookModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) handleNotebookCancel();
          }}
        >
          <div
            className="w-[340px] rounded-2xl border p-5 shadow-xl"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-modal)",
            }}
          >
            <div className="mb-4 flex items-center gap-2">
              <BookOpen size={18} style={{ color: "var(--accent)" }} />
              <h3
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {t("notebook.new")}
              </h3>
            </div>
            <input
              ref={notebookInputRef}
              value={notebookName}
              onChange={(e) => setNotebookName(e.target.value)}
              placeholder={t("notebook.name_placeholder")}
              className="mb-4 w-full rounded-lg border px-3 py-2 text-sm transition-colors outline-none focus:border-[var(--accent)]"
              style={{
                backgroundColor: "var(--bg-secondary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNotebookConfirm();
                if (e.key === "Escape") handleNotebookCancel();
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={handleNotebookCancel}
                className="interactive-ghost rounded-lg px-4 py-2 text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleNotebookConfirm}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "#fff",
                  opacity: notebookName.trim() ? 1 : 0.5,
                  cursor: notebookName.trim() ? "pointer" : "default",
                }}
              >
                {t("common.create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

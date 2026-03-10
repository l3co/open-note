import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Clock,
  FileText,
  Plus,
  BookOpen,
  Search,
  Settings,
} from "lucide-react";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { usePageStore } from "@/stores/usePageStore";
import { useUIStore } from "@/stores/useUIStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { useMultiWorkspaceStore } from "@/stores/useMultiWorkspaceStore";
import { BackgroundPattern } from "@/components/shared/BackgroundPattern";
import { Button } from "@/components/ui";
import logoSrc from "@/assets/logo.png";

function getGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "home.greeting_morning";
  if (hour < 18) return "home.greeting_afternoon";
  return "home.greeting_evening";
}

export function HomePage() {
  const { t } = useTranslation();
  const { history, selectPage } = useNavigationStore();
  const { loadPage, pages, createPage } = usePageStore();
  const { openQuickOpen, openSettings } = useUIStore();
  const { createNotebook, sections } = useWorkspaceStore();
  const quickNotesSectionId = useMultiWorkspaceStore(
    (s) => s.focusedSlice()?.workspace.settings?.quick_notes_section_id ?? null,
  );

  const [showNotebookModal, setShowNotebookModal] = useState(false);
  const [notebookName, setNotebookName] = useState("");
  const notebookInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showNotebookModal) {
      setTimeout(() => notebookInputRef.current?.focus(), 30);
    }
  }, [showNotebookModal]);

  const allPages: { id: string; title: string }[] = [];
  pages.forEach((sectionPages) => {
    sectionPages.forEach((p) => allPages.push(p));
  });

  const recentPageIds = [...history]
    .reverse()
    .filter((id, idx, arr) => arr.indexOf(id) === idx)
    .slice(0, 6);
  const recentPages = recentPageIds
    .map((id) => allPages.find((p) => p.id === id))
    .filter(Boolean) as { id: string; title: string }[];

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
    const targetSectionId =
      quickNotesSectionId ??
      (() => {
        for (const [, sectionList] of sections) {
          if (sectionList.length > 0) return sectionList[0]?.id ?? null;
        }
        return null;
      })();

    if (targetSectionId) {
      try {
        const page = await createPage(targetSectionId, t("page.new"));
        selectPage(page.id);
        await loadPage(page.id);
      } catch {
        /* errors handled by store */
      }
      return;
    }
    openQuickOpen();
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
        <div className="mb-10 flex items-center gap-4">
          <img src={logoSrc} alt="Open Note" className="h-10 w-10" />
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {t(getGreetingKey())}
          </h1>
        </div>

        <section className="mb-10">
          <div className="mb-3 flex items-center gap-2">
            <Clock size={14} style={{ color: "var(--text-tertiary)" }} />
            <h2
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: "var(--text-tertiary)" }}
            >
              {t("home.recent_pages")}
            </h2>
          </div>

          {recentPages.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {recentPages.map((page) => (
                <button
                  key={page.id}
                  onClick={() => handlePageClick(page.id)}
                  className="group flex flex-col items-start rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 text-left transition-all hover:border-[var(--accent)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                >
                  <FileText
                    size={18}
                    className="mb-2"
                    style={{ color: "var(--text-tertiary)" }}
                  />
                  <span
                    className="w-full truncate text-sm font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {page.title}
                  </span>
                </button>
              ))}
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

        <section>
          <h2
            className="mb-3 text-xs font-semibold tracking-widest uppercase"
            style={{ color: "var(--text-tertiary)" }}
          >
            {t("home.quick_actions")}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              icon={<Plus size={18} className="text-[var(--accent)]" />}
              shortcut="⌘N"
              onClick={handleNewPage}
              fullWidth
              className="!justify-start border border-[var(--border)] !py-6 hover:border-[var(--accent)] hover:shadow-sm"
            >
              {t("home.action_new_page")}
            </Button>
            <Button
              variant="secondary"
              icon={<BookOpen size={18} className="text-[var(--accent)]" />}
              shortcut="⌘⇧N"
              onClick={handleNewNotebook}
              fullWidth
              className="!justify-start border border-[var(--border)] !py-6 hover:border-[var(--accent)] hover:shadow-sm"
            >
              {t("home.action_new_notebook")}
            </Button>
            <Button
              variant="secondary"
              icon={<Search size={18} className="text-[var(--accent)]" />}
              shortcut="⌘K"
              onClick={openQuickOpen}
              fullWidth
              className="!justify-start border border-[var(--border)] !py-6 hover:border-[var(--accent)] hover:shadow-sm"
            >
              {t("home.action_search")}
            </Button>
            <Button
              variant="secondary"
              icon={<Settings size={18} className="text-[var(--accent)]" />}
              shortcut="⌘,"
              onClick={openSettings}
              fullWidth
              className="!justify-start border border-[var(--border)] !py-6 hover:border-[var(--accent)] hover:shadow-sm"
            >
              {t("home.action_settings")}
            </Button>
          </div>
        </section>
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
            className="w-[340px] rounded-xl border p-5 shadow-xl"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-lg)",
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

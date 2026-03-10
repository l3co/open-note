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
  const { loadPage, pages } = usePageStore();
  const { openQuickOpen, openSettings } = useUIStore();

  const allPages: { id: string; title: string }[] = [];
  pages.forEach((sectionPages) => {
    sectionPages.forEach((p) => allPages.push(p));
  });

  const recentPageIds = [...history].reverse().slice(0, 6);
  const recentPages = recentPageIds
    .map((id) => allPages.find((p) => p.id === id))
    .filter(Boolean) as { id: string; title: string }[];

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
              onClick={() => {}}
              fullWidth
              className="!justify-start border border-[var(--border)] !py-6 hover:border-[var(--accent)] hover:shadow-sm"
            >
              {t("home.action_new_page")}
            </Button>
            <Button
              variant="secondary"
              icon={<BookOpen size={18} className="text-[var(--accent)]" />}
              shortcut="⌘⇧N"
              onClick={() => {}}
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
    </div>
  );
}

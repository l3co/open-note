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
            <Clock
              size={14}
              style={{ color: "var(--text-tertiary)" }}
            />
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
                  className="group flex flex-col items-start rounded-xl border p-4 text-left transition-all"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: "var(--bg-secondary)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.boxShadow =
                      "0 2px 8px rgba(0,0,0,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
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
              <FileText
                size={28}
                className="mx-auto mb-2 opacity-30"
              />
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
            <QuickAction
              icon={<Plus size={18} />}
              label={t("home.action_new_page")}
              shortcut="⌘N"
              onClick={() => {}}
            />
            <QuickAction
              icon={<BookOpen size={18} />}
              label={t("home.action_new_notebook")}
              shortcut="⌘⇧N"
              onClick={() => {}}
            />
            <QuickAction
              icon={<Search size={18} />}
              label={t("home.action_search")}
              shortcut="⌘K"
              onClick={openQuickOpen}
            />
            <QuickAction
              icon={<Settings size={18} />}
              label={t("home.action_settings")}
              shortcut="⌘,"
              onClick={openSettings}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  shortcut,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--bg-secondary)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--accent)";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{
          backgroundColor: "var(--accent-subtle)",
          color: "var(--accent)",
        }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <span
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {label}
        </span>
      </div>
      <kbd
        className="rounded px-1.5 py-0.5 text-[11px]"
        style={{
          backgroundColor: "var(--bg-tertiary)",
          color: "var(--text-tertiary)",
          border: "1px solid var(--border)",
        }}
      >
        {shortcut}
      </kbd>
    </button>
  );
}

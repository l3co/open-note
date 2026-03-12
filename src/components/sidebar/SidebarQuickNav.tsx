import { useTranslation } from "react-i18next";
import { Search, Home, CalendarDays, Tag, Plus } from "lucide-react";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { useUIStore } from "@/stores/useUIStore";
import { usePageStore } from "@/stores/usePageStore";
import * as ipc from "@/lib/ipc";
import { clsx } from "clsx";

export function SidebarQuickNav() {
  const { t } = useTranslation();
  const { activeView, setActiveView, selectPage } = useNavigationStore();
  const { openQuickOpen } = useUIStore();
  const { createPage, loadPage } = usePageStore();

  const handleNewPage = async () => {
    try {
      const sectionId = await ipc.ensureQuickNotes();
      const page = await createPage(sectionId, t("page.new"));
      selectPage(page.id);
      await loadPage(page.id);
    } catch {
      /* errors handled by stores */
    }
  };

  return (
    <div className="space-y-1">
      {/* CTA: New Page */}
      <button
        onClick={handleNewPage}
        className="interactive-accent mb-2 flex h-8 w-full items-center gap-2 rounded-lg px-3 text-[13px] font-semibold"
      >
        <Plus size={15} />
        {t("page.new")}
      </button>

      {/* Search inline */}
      <button
        onClick={openQuickOpen}
        className="interactive-ghost flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        <Search size={14} className="shrink-0" />
        <span className="flex-1 truncate">{t("sidebar.search")}</span>
        <span
          className="shrink-0 rounded px-1 py-0.5 font-mono text-[10px]"
          style={{ backgroundColor: "var(--bg-tertiary)" }}
        >
          ⌘K
        </span>
      </button>

      <QuickNavItem
        icon={<Home size={16} />}
        label={t("sidebar.home")}
        active={activeView === "home"}
        onClick={() => setActiveView("home")}
      />
      <QuickNavItem
        icon={<CalendarDays size={16} />}
        label={t("sidebar.calendar")}
        badge={t("sidebar.calendar_coming_soon")}
        disabled
      />

      <div className="pt-1">
        <QuickNavItem
          icon={<Tag size={16} />}
          label={t("sidebar.tags")}
          active={activeView === "tags"}
          onClick={() => setActiveView("tags")}
        />
      </div>
    </div>
  );
}

function QuickNavItem({
  icon,
  label,
  active = false,
  disabled = false,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  badge?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "interactive-ghost flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[14px] font-medium transition-colors disabled:opacity-40",
        active ? "text-[var(--accent)]" : "text-[var(--text-secondary)]",
      )}
      data-active={active}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="flex-1 truncate text-left">{label}</span>
      {badge && (
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px]"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-tertiary)",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

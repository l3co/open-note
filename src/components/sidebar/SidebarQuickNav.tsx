import { useTranslation } from "react-i18next";
import { Search, Home, CalendarDays, Tag } from "lucide-react";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { useUIStore } from "@/stores/useUIStore";

export function SidebarQuickNav() {
  const { t } = useTranslation();
  const { activeView, setActiveView } = useNavigationStore();
  const { openQuickOpen } = useUIStore();

  return (
    <div className="space-y-0.5">
      <QuickNavItem
        icon={<Search size={16} />}
        label={t("sidebar.search")}
        onClick={openQuickOpen}
      />
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
      className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[14px] font-medium transition-colors disabled:opacity-40"
      style={{
        color: active ? "var(--accent)" : "var(--text-secondary)",
        backgroundColor: active ? "var(--accent-subtle)" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled)
          e.currentTarget.style.backgroundColor = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active)
          e.currentTarget.style.backgroundColor = "transparent";
      }}
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

import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeft } from "lucide-react";
import { useUIStore } from "@/stores/useUIStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export function Toolbar() {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { goBack, goForward, historyIndex, history } = useNavigationStore();
  const { t } = useTranslation();

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  return (
    <header
      data-tauri-drag-region
      className="flex h-10 items-center border-b px-2 select-none"
      style={{
        backgroundColor: "var(--bg-toolbar)",
        borderColor: "var(--border)",
      }}
    >
      <button
        onClick={toggleSidebar}
        className="flex h-7 w-7 items-center justify-center rounded"
        style={{ color: "var(--text-secondary)" }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "var(--bg-hover)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "transparent")
        }
        aria-label={t("toolbar.toggle_sidebar")}
      >
        {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
      </button>

      <div className="ml-1 flex items-center gap-0.5">
        <button
          onClick={goBack}
          disabled={!canGoBack}
          className="flex h-7 w-7 items-center justify-center rounded disabled:opacity-30"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={(e) => {
            if (canGoBack)
              e.currentTarget.style.backgroundColor = "var(--bg-hover)";
          }}
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
          aria-label="Back"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={goForward}
          disabled={!canGoForward}
          className="flex h-7 w-7 items-center justify-center rounded disabled:opacity-30"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={(e) => {
            if (canGoForward)
              e.currentTarget.style.backgroundColor = "var(--bg-hover)";
          }}
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
          aria-label="Forward"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="ml-3 flex-1">
        <Breadcrumb />
      </div>
    </header>
  );
}

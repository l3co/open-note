import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useUIStore } from "@/stores/useUIStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { IconButton } from "@/components/ui";

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
      data-testid="toolbar"
    >
      <IconButton
        onClick={toggleSidebar}
        icon={sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
        aria-label={t("toolbar.toggle_sidebar")}
        variant="subtle"
      />

      <div className="ml-1 flex items-center gap-0.5">
        <IconButton
          onClick={goBack}
          disabled={!canGoBack}
          icon={<ChevronLeft size={16} />}
          aria-label="Back"
          variant="subtle"
        />
        <IconButton
          onClick={goForward}
          disabled={!canGoForward}
          icon={<ChevronRight size={16} />}
          aria-label="Forward"
          variant="subtle"
        />
      </div>

      <div className="ml-3 flex-1" data-testid="breadcrumb">
        <Breadcrumb />
      </div>
    </header>
  );
}

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
      className="flex h-11 items-center gap-1 border-b px-3 select-none"
      style={{
        backgroundColor: "var(--bg-toolbar)",
        borderColor: "var(--border)",
      }}
      data-testid="toolbar"
    >
      <IconButton
        onClick={toggleSidebar}
        icon={
          sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />
        }
        aria-label={t("toolbar.toggle_sidebar")}
        variant="subtle"
      />

      <div
        className="h-5 w-px shrink-0"
        style={{ backgroundColor: "var(--border)" }}
      />

      <div className="flex items-center gap-0.5">
        <IconButton
          onClick={goBack}
          disabled={!canGoBack}
          icon={<ChevronLeft size={15} />}
          aria-label="Back"
          variant="subtle"
        />
        <IconButton
          onClick={goForward}
          disabled={!canGoForward}
          icon={<ChevronRight size={15} />}
          aria-label="Forward"
          variant="subtle"
        />
      </div>

      <div
        className="h-5 w-px shrink-0"
        style={{ backgroundColor: "var(--border)" }}
      />

      <div className="min-w-0 flex-1" data-testid="breadcrumb">
        <Breadcrumb />
      </div>
    </header>
  );
}

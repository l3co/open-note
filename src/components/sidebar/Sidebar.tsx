import { useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "@/stores/useUIStore";
import { WorkspaceSwitcher } from "@/components/sidebar/WorkspaceSwitcher";
import { SidebarQuickNav } from "@/components/sidebar/SidebarQuickNav";
import { NotebookTree } from "@/components/sidebar/NotebookTree";
import { SidebarFooter } from "@/components/sidebar/SidebarFooter";

export function Sidebar() {
  const { sidebarOpen, sidebarWidth, setSidebarWidth, openWorkspacePicker } =
    useUIStore();
  const { t } = useTranslation();
  const resizeRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  const handleMouseDown = useCallback(() => {
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      setSidebarWidth(e.clientX);
    };

    const handleMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [setSidebarWidth]);

  if (!sidebarOpen) return null;

  return (
    <aside
      className="relative flex flex-col border-r"
      style={{
        width: sidebarWidth,
        minWidth: 260,
        maxWidth: 460,
        backgroundColor: "var(--bg-sidebar)",
        borderColor: "var(--border)",
      }}
      data-testid="sidebar"
    >
      <WorkspaceSwitcher onOpenWorkspacePicker={openWorkspacePicker} />

      <nav
        className="flex-1 overflow-y-auto px-3.5 pt-3"
        aria-label={t("sidebar.notebooks")}
        data-testid="sidebar-nav"
      >
        <SidebarQuickNav />

        <div className="mt-5 mb-2 flex items-center px-1">
          <h2
            className="text-xs font-semibold tracking-[0.16em] uppercase"
            style={{ color: "var(--text-tertiary)" }}
          >
            {t("sidebar.notebooks")}
          </h2>
        </div>

        <NotebookTree />
      </nav>

      <SidebarFooter />

      <div
        ref={resizeRef}
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-[var(--accent)]"
        style={{ opacity: 0.3 }}
        data-testid="sidebar-resize-handle"
      />
    </aside>
  );
}

import { useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "@/stores/useUIStore";
import { SidebarQuickNav } from "@/components/sidebar/SidebarQuickNav";
import { NotebookTree } from "@/components/sidebar/NotebookTree";
import { SidebarFooter } from "@/components/sidebar/SidebarFooter";

export function Sidebar() {
  const { sidebarOpen, sidebarWidth, setSidebarWidth } = useUIStore();
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
        minWidth: 200,
        maxWidth: 400,
        backgroundColor: "var(--bg-sidebar)",
        borderColor: "var(--border)",
      }}
      data-testid="sidebar"
    >
      <nav
        className="flex-1 overflow-y-auto px-3 pt-3"
        aria-label={t("sidebar.notebooks")}
        data-testid="sidebar-nav"
      >
        <SidebarQuickNav />

        <div className="mt-4 mb-1.5 flex items-center px-1">
          <h2
            className="text-[11px] font-semibold tracking-widest uppercase"
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

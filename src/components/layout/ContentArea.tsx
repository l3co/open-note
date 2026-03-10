import { useMultiWorkspaceStore } from "@/stores/useMultiWorkspaceStore";
import { usePageStore } from "@/stores/usePageStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { HomePage } from "@/components/pages/HomePage";
import { TagsPage } from "@/components/pages/TagsPage";
import { PageView } from "@/components/pages/PageView";
import { SectionOverview } from "@/components/pages/SectionOverview";
import { NotebookOverview } from "@/components/pages/NotebookOverview";
import { Loader2 } from "lucide-react";

export function ContentArea() {
  const focusedWorkspaceId = useMultiWorkspaceStore(
    (s) => s.focusedWorkspaceId,
  );
  const { activeView, selectedPageId } = useNavigationStore();
  const { currentPage, isLoading } = usePageStore();

  if (isLoading) {
    return (
      <div
        className="flex flex-1 items-center justify-center"
        style={{ backgroundColor: "var(--bg-primary)" }}
        data-testid="content-loading"
      >
        <Loader2
          size={24}
          className="animate-spin"
          style={{ color: "var(--text-tertiary)" }}
        />
      </div>
    );
  }

  let content: React.ReactNode;

  if (
    activeView === "home" ||
    (!selectedPageId &&
      activeView !== "tags" &&
      activeView !== "section" &&
      activeView !== "notebook")
  ) {
    content = <HomePage />;
  } else if (activeView === "tags") {
    content = <TagsPage />;
  } else if (activeView === "notebook") {
    content = <NotebookOverview />;
  } else if (activeView === "section") {
    content = <SectionOverview />;
  } else if (!currentPage) {
    content = <HomePage />;
  } else {
    content = <PageView page={currentPage} />;
  }

  return (
    <div
      key={focusedWorkspaceId ?? "none"}
      className="flex flex-1 flex-col overflow-hidden"
      style={{
        animation: "workspace-fade-in 150ms ease",
      }}
      data-testid="content-area-inner"
    >
      {content}
    </div>
  );
}

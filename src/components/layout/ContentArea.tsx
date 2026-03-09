import { usePageStore } from "@/stores/usePageStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { HomePage } from "@/components/pages/HomePage";
import { TagsPage } from "@/components/pages/TagsPage";
import { PageView } from "@/components/pages/PageView";
import { Loader2 } from "lucide-react";

export function ContentArea() {
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

  if (activeView === "home" || (!selectedPageId && activeView !== "tags")) {
    return <HomePage />;
  }

  if (activeView === "tags") {
    return <TagsPage />;
  }

  if (!currentPage) {
    return <HomePage />;
  }

  return <PageView page={currentPage} />;
}

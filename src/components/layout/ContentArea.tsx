import { usePageStore } from "@/stores/usePageStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { WelcomePage } from "@/components/pages/WelcomePage";
import { PageView } from "@/components/pages/PageView";
import { Loader2 } from "lucide-react";

export function ContentArea() {
  const { selectedPageId } = useNavigationStore();
  const { currentPage, isLoading } = usePageStore();

  if (isLoading) {
    return (
      <div
        className="flex flex-1 items-center justify-center"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        <Loader2
          size={24}
          className="animate-spin"
          style={{ color: "var(--text-tertiary)" }}
        />
      </div>
    );
  }

  if (!selectedPageId || !currentPage) {
    return <WelcomePage />;
  }

  return <PageView page={currentPage} />;
}

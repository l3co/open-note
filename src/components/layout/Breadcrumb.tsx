import { ChevronRight } from "lucide-react";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { usePageStore } from "@/stores/usePageStore";

export function Breadcrumb() {
  const {
    selectedNotebookId,
    selectedSectionId,
    selectedPageId,
    openSectionOverview,
    openNotebookOverview,
  } = useNavigationStore();
  const { notebooks, sections } = useWorkspaceStore();
  const currentPage = usePageStore((s) => s.currentPage);

  const actualSectionId = selectedSectionId || currentPage?.section_id;

  let section;
  if (actualSectionId) {
    for (const sectionList of sections.values()) {
      const found = sectionList.find((s) => s.id === actualSectionId);
      if (found) {
        section = found;
        break;
      }
    }
  }

  const actualNotebookId = selectedNotebookId || section?.notebook_id;
  const notebook = notebooks.find((n) => n.id === actualNotebookId);

  if (!notebook) return null;

  type BreadcrumbItem = { label: string; onClick?: () => void };
  const items: BreadcrumbItem[] = [
    {
      label: notebook.name,
      onClick: () => openNotebookOverview(notebook.id),
    },
  ];
  if (section) {
    items.push({
      label: section.name,
      onClick: () => openSectionOverview(section.id),
    });
  }
  if (currentPage && selectedPageId) {
    items.push({ label: currentPage.title });
  }

  return (
    <nav
      className="flex items-center gap-1 text-xs"
      style={{ color: "var(--text-secondary)" }}
      aria-label="Breadcrumb"
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight
                size={12}
                style={{ color: "var(--text-tertiary)" }}
              />
            )}
            {item.onClick && !isLast ? (
              <button
                onClick={item.onClick}
                className="rounded px-0.5 transition-colors hover:underline"
                style={{ color: "var(--text-secondary)" }}
              >
                {item.label}
              </button>
            ) : (
              <span
                className={isLast ? "font-medium" : ""}
                style={isLast ? { color: "var(--text-primary)" } : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

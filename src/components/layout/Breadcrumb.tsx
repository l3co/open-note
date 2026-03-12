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
      className="flex items-center gap-0.5 text-[13px]"
      aria-label="Breadcrumb"
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && (
              <span
                className="mx-1 text-[11px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                /
              </span>
            )}
            {item.onClick && !isLast ? (
              <button
                onClick={item.onClick}
                className="truncate transition-colors hover:underline"
                style={{ color: "var(--text-secondary)" }}
              >
                {item.label}
              </button>
            ) : (
              <span
                className={isLast ? "truncate font-semibold" : "truncate"}
                style={{
                  color: isLast
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                }}
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

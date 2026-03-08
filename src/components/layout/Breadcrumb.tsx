import { ChevronRight } from "lucide-react";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { usePageStore } from "@/stores/usePageStore";

export function Breadcrumb() {
  const { selectedNotebookId, selectedSectionId, selectedPageId } =
    useNavigationStore();
  const { notebooks, sections } = useWorkspaceStore();
  const currentPage = usePageStore((s) => s.currentPage);

  const notebook = notebooks.find((n) => n.id === selectedNotebookId);
  const sectionList = selectedNotebookId
    ? sections.get(selectedNotebookId)
    : undefined;
  const section = sectionList?.find((s) => s.id === selectedSectionId);

  if (!notebook) return null;

  const items: string[] = [notebook.name];
  if (section) items.push(section.name);
  if (currentPage && selectedPageId) items.push(currentPage.title);

  return (
    <nav
      className="flex items-center gap-1 text-xs"
      style={{ color: "var(--text-secondary)" }}
      aria-label="Breadcrumb"
    >
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <ChevronRight size={12} style={{ color: "var(--text-tertiary)" }} />
          )}
          <span
            className={i === items.length - 1 ? "font-medium" : ""}
            style={
              i === items.length - 1
                ? { color: "var(--text-primary)" }
                : undefined
            }
          >
            {item}
          </span>
        </span>
      ))}
    </nav>
  );
}

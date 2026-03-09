import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Tag, Loader2, Hash, FileText } from "lucide-react";
import { BackgroundPattern } from "@/components/shared/BackgroundPattern";
import { listAllTags, searchPages } from "@/lib/ipc";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { usePageStore } from "@/stores/usePageStore";
import type { SearchResultItem } from "@/types/search";

export function TagsPage() {
  const { t } = useTranslation();
  const selectPage = useNavigationStore((s) => s.selectPage);
  const loadPage = usePageStore((s) => s.loadPage);

  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados gerenciais de clique na tag
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [notes, setNotes] = useState<SearchResultItem[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  useEffect(() => {
    async function fetchTags() {
      try {
        setLoading(true);
        const fetchedTags = await listAllTags();
        setTags(fetchedTags);
      } catch (err) {
        console.error("Failed to fetch tags:", err);
        setError("Erro ao carregar tags");
      } finally {
        setLoading(false);
      }
    }

    fetchTags();
  }, []);

  useEffect(() => {
    async function fetchNotesForTag() {
      if (!selectedTag) {
        setNotes([]);
        return;
      }
      try {
        setLoadingNotes(true);
        const resp = await searchPages({
          text: "",
          tags: [selectedTag],
        });
        setNotes(resp.items);
      } catch (err) {
        console.error("Failed to fetch notes for tag:", err);
      } finally {
        setLoadingNotes(false);
      }
    }

    fetchNotesForTag();
  }, [selectedTag]);

  return (
    <div
      className="relative flex flex-1 flex-col"
      style={{ backgroundColor: "var(--bg-primary)" }}
      data-testid="tags-page"
    >
      <header
        className="flex h-12 shrink-0 items-center border-b px-4"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <h1
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          <Tag size={16} />
          {t("sidebar.tags")}
        </h1>
      </header>

      <div
        className="relative flex-1 overflow-y-auto p-6"
        data-testid="tags-content"
      >
        <BackgroundPattern />

        <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col gap-8">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2
                className="animate-spin opacity-50"
                size={24}
                style={{ color: "var(--text-tertiary)" }}
              />
            </div>
          ) : error ? (
            <div className="flex h-40 flex-col items-center justify-center text-center">
              <p
                className="text-sm"
                style={{ color: "var(--text-error, red)" }}
              >
                {t("tags.error_load")}
              </p>
            </div>
          ) : tags.length === 0 ? (
            <div className="mt-20 text-center">
              <Tag
                size={40}
                className="mx-auto mb-4 opacity-30"
                style={{ color: "var(--text-tertiary)" }}
              />
              <h2
                className="text-lg font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {t("tags.empty_title")}
              </h2>
              <p
                className="mt-2 text-sm"
                style={{ color: "var(--text-tertiary)" }}
              >
                {t("tags.empty_desc")}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() =>
                    setSelectedTag(selectedTag === tag ? null : tag)
                  }
                  className="flex items-center gap-2 rounded-lg border p-3 text-left transition-colors"
                  style={{
                    backgroundColor:
                      selectedTag === tag
                        ? "var(--accent-subtle)"
                        : "var(--bg-secondary)",
                    borderColor:
                      selectedTag === tag
                        ? "var(--accent)"
                        : "var(--border-subtle)",
                    color:
                      selectedTag === tag
                        ? "var(--accent)"
                        : "var(--text-primary)",
                  }}
                >
                  <Hash
                    size={16}
                    style={{
                      color:
                        selectedTag === tag
                          ? "var(--accent)"
                          : "var(--text-tertiary)",
                    }}
                  />
                  <span className="truncate text-sm font-medium">{tag}</span>
                </button>
              ))}
            </div>
          )}

          {/* Secção de Listagem de Notas baseada na Tag */}
          {selectedTag && (
            <div
              className="mt-4 border-t pt-8"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <h2
                className="mb-6 flex items-center gap-2 text-lg font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                <Hash size={20} style={{ color: "var(--accent)" }} />
                {selectedTag}
              </h2>

              {loadingNotes ? (
                <div className="flex h-20 items-center justify-center">
                  <Loader2
                    className="animate-spin opacity-50"
                    size={20}
                    style={{ color: "var(--text-tertiary)" }}
                  />
                </div>
              ) : notes.length === 0 ? (
                <p
                  className="text-sm"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Nenhuma nota encontrada para esta tag.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {notes.map((note) => (
                    <button
                      key={note.page_id}
                      onClick={() => {
                        selectPage(note.page_id);
                        loadPage(note.page_id);
                      }}
                      className="group flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all hover:-translate-y-1 hover:shadow-md"
                      style={{
                        backgroundColor: "var(--bg-secondary)",
                        borderColor: "var(--border-subtle)",
                      }}
                    >
                      <div className="flex w-full items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileText
                            size={16}
                            style={{ color: "var(--text-tertiary)" }}
                          />
                          <span
                            className="line-clamp-1 font-medium break-all"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {note.title || t("page.untitled")}
                          </span>
                        </div>
                      </div>
                      <div
                        className="mt-1 flex w-full items-center gap-1.5 text-xs"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        <span className="truncate">{note.notebook_name}</span>
                        <span>•</span>
                        <span className="truncate">{note.section_name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

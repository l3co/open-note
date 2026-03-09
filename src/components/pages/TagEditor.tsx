import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { X, Plus } from "lucide-react";
import { usePageStore } from "@/stores/usePageStore";
import * as ipc from "@/lib/ipc";

interface TagEditorProps {
  pageId: string;
  tags: string[];
}

export function TagEditor({ tags }: TagEditorProps) {
  const { currentPage, updatePage } = usePageStore();
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) {
      ipc
        .listAllTags()
        .then(setAllTags)
        .catch(() => { });
      inputRef.current?.focus();
    }
  }, [isAdding]);

  const suggestions = useMemo(() => {
    if (!draft.trim()) return [];
    const lower = draft.toLowerCase();
    return allTags
      .filter((t) => t.toLowerCase().includes(lower) && !tags.includes(t))
      .slice(0, 5);
  }, [draft, allTags, tags]);

  const addTag = useCallback(
    async (tag: string) => {
      const normalized = tag.trim().toLowerCase();
      if (!normalized || !currentPage) return;
      if (tags.includes(normalized)) return;
      if (tags.length >= 20) return;

      const updated = {
        ...currentPage,
        tags: [...currentPage.tags, normalized],
      };
      await updatePage(updated);
      setDraft("");
    },
    [currentPage, tags, updatePage],
  );

  const removeTag = useCallback(
    async (tag: string) => {
      if (!currentPage) return;
      const updated = {
        ...currentPage,
        tags: currentPage.tags.filter((t) => t !== tag),
      };
      await updatePage(updated);
    },
    [currentPage, updatePage],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addTag(draft);
      }
      if (e.key === "Escape") {
        setIsAdding(false);
        setDraft("");
      }
    },
    [draft, addTag],
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs"
          style={{
            backgroundColor: "var(--accent-subtle)",
            color: "var(--accent)",
          }}
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            className="flex items-center rounded-full p-0.5 hover:opacity-70"
            aria-label={`Remover tag ${tag}`}
          >
            <X size={10} />
          </button>
        </span>
      ))}

      {isAdding ? (
        <div className="relative">
          <input
            ref={inputRef}
            className="h-6 w-32 rounded border bg-transparent px-2 text-xs outline-none"
            style={{
              borderColor: "var(--accent)",
              color: "var(--text-primary)",
            }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              setTimeout(() => {
                setIsAdding(false);
                setDraft("");
              }, 150);
            }}
            placeholder="Nova tag..."
          />
          {suggestions.length > 0 && (
            <ul
              className="absolute top-7 left-0 z-50 w-40 rounded border py-1 shadow-lg"
              style={{
                backgroundColor: "var(--bg-primary)",
                borderColor: "var(--border)",
              }}
            >
              {suggestions.map((s) => (
                <li
                  key={s}
                  className="interactive-ghost cursor-pointer px-3 py-1 text-xs text-[var(--text-primary)]"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addTag(s);
                  }}
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="interactive-ghost flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-[var(--text-tertiary)]"
        >
          <Plus size={10} />
          tag
        </button>
      )}
    </div>
  );
}

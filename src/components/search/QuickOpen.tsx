import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Search, FileText } from "lucide-react";
import { useUIStore } from "@/stores/useUIStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { quickOpen } from "@/lib/ipc";
import type { SearchResultItem } from "@/types/search";

export function QuickOpen() {
  const show = useUIStore((s) => s.showQuickOpen);
  const close = useUIStore((s) => s.closeQuickOpen);
  const selectPage = useNavigationStore((s) => s.selectPage);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (show) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [show]);

  const doSearch = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const items = await quickOpen(text, 10);
        setResults(items);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 150);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    doSearch(value);
  };

  const openResult = useCallback(
    (item: SearchResultItem) => {
      selectPage(item.page_id);
      close();
    },
    [selectPage, close],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIndex]) {
        openResult(results[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      close();
    }
  };

  useEffect(() => {
    if (!show) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [show, close]);

  if (!show) return null;

  return (
    <div className="quick-open-backdrop" onClick={close}>
      <div
        className="quick-open-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="quick-open-input-wrapper">
          <Search size={18} className="quick-open-icon" />
          <input
            ref={inputRef}
            type="text"
            className="quick-open-input"
            placeholder={t("search.quick_open_placeholder")}
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {results.length > 0 && (
          <div className="quick-open-results">
            {results.map((item, index) => (
              <button
                key={item.page_id}
                className={`quick-open-result-item ${index === selectedIndex ? "selected" : ""}`}
                onClick={() => openResult(item)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <FileText size={16} className="quick-open-result-icon" />
                <div className="quick-open-result-content">
                  <span className="quick-open-result-title">{item.title}</span>
                  <span className="quick-open-result-path">
                    {item.notebook_name} &rsaquo; {item.section_name}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {query && !loading && results.length === 0 && (
          <div className="quick-open-empty">{t("search.no_results")}</div>
        )}
      </div>
    </div>
  );
}

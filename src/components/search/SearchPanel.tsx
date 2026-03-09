import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Search, FileText, X, Clock } from "lucide-react";
import { useUIStore } from "@/stores/useUIStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { usePageStore } from "@/stores/usePageStore";
import { searchPages } from "@/lib/ipc";
import type { SearchResultItem, SearchQuery } from "@/types/search";

export function SearchPanel() {
  const show = useUIStore((s) => s.showSearchPanel);
  const close = useUIStore((s) => s.closeSearchPanel);
  const selectPage = useNavigationStore((s) => s.selectPage);
  const loadPage = usePageStore((s) => s.loadPage);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [queryTimeMs, setQueryTimeMs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (show) {
      setQuery("");
      setResults([]);
      setTotal(0);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [show]);

  const doSearch = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const searchQuery: SearchQuery = { text, limit: 20, offset: 0 };
        const res = await searchPages(searchQuery);
        setResults(res.items);
        setTotal(res.total);
        setQueryTimeMs(res.query_time_ms);
        setSelectedIndex(0);
      } catch {
        setResults([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    doSearch(value);
  };

  const openResult = useCallback(
    (item: SearchResultItem) => {
      selectPage(item.page_id);
      loadPage(item.page_id);
      close();
    },
    [selectPage, loadPage, close],
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

  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 60) return `${diffMins}min`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d`;
    } catch {
      return "";
    }
  };

  if (!show) return null;

  return (
    <div className="search-panel">
      <div className="search-panel-header">
        <h3 className="search-panel-title">{t("sidebar.search")}</h3>
        <button className="search-panel-close" onClick={close}>
          <X size={16} />
        </button>
      </div>

      <div className="search-panel-input-wrapper">
        <Search size={16} className="search-panel-icon" />
        <input
          ref={inputRef}
          type="text"
          className="search-panel-input"
          placeholder={t("search.panel_placeholder")}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {query && !loading && results.length > 0 && (
        <div className="search-panel-meta">
          {t("search.results_count", { count: total })} — {queryTimeMs}ms
        </div>
      )}

      <div className="search-panel-results">
        {results.map((item, index) => (
          <button
            key={item.page_id}
            className={`search-panel-result ${index === selectedIndex ? "selected" : ""}`}
            onClick={() => openResult(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <FileText size={16} className="search-result-icon" />
            <div className="search-result-body">
              <span className="search-result-title">{item.title}</span>
              {item.snippet && (
                <span className="search-result-snippet">{item.snippet}</span>
              )}
              <span className="search-result-meta">
                {item.notebook_name} &rsaquo; {item.section_name}
                {item.updated_at && (
                  <>
                    {" "}
                    <Clock
                      size={12}
                      style={{ display: "inline", verticalAlign: "middle" }}
                    />{" "}
                    {formatTimeAgo(item.updated_at)}
                  </>
                )}
              </span>
            </div>
          </button>
        ))}

        {query && !loading && results.length === 0 && (
          <div className="search-panel-empty">{t("search.no_results")}</div>
        )}
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { ExternalLink, Trash2 } from "lucide-react";

interface LinkPopoverProps {
  initialUrl: string;
  onSubmit: (url: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function LinkPopover({
  initialUrl,
  onSubmit,
  onRemove,
  onClose,
}: LinkPopoverProps) {
  const [url, setUrl] = useState(initialUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed) {
      const withProtocol = trimmed.match(/^https?:\/\//)
        ? trimmed
        : `https://${trimmed}`;
      onSubmit(withProtocol);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="absolute top-full left-0 z-50 mt-1 rounded-lg border p-2 shadow-lg"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border)",
        minWidth: "280px",
      }}
    >
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <ExternalLink
          size={14}
          style={{ color: "var(--text-tertiary)", flexShrink: 0 }}
        />
        <input
          ref={inputRef}
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://..."
          className="flex-1 rounded border px-2 py-1 text-sm outline-none"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        />
        {initialUrl && (
          <button
            type="button"
            onClick={onRemove}
            title="Remover link"
            className="flex h-7 w-7 items-center justify-center rounded"
            style={{ color: "var(--text-tertiary)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--bg-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <Trash2 size={14} />
          </button>
        )}
      </form>
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Play, ExternalLink, Youtube, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface OEmbedData {
  title: string;
  author_name: string;
  thumbnail_url: string;
}

async function fetchOEmbed(url: string): Promise<OEmbedData | null> {
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    return (await res.json()) as OEmbedData;
  } catch {
    return null;
  }
}

export function YoutubeBlockNodeView({ node, updateAttributes }: NodeViewProps) {
  const { videoId, url, title, thumbnailUrl, authorName } = node.attrs as {
    videoId: string;
    url: string;
    title: string | null;
    thumbnailUrl: string | null;
    authorName: string | null;
  };

  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const [metaLoading, setMetaLoading] = useState(!title);
  const [thumbError, setThumbError] = useState(false);

  const effectiveThumbnail = thumbError
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : (thumbnailUrl ?? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);

  useEffect(() => {
    if (title || !url) return;
    let cancelled = false;

    setMetaLoading(true);
    fetchOEmbed(url).then((data) => {
      if (cancelled || !data) {
        setMetaLoading(false);
        return;
      }
      updateAttributes({
        title: data.title,
        authorName: data.author_name,
        thumbnailUrl: data.thumbnail_url,
      });
      setMetaLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [url, title, updateAttributes]);

  const handlePlay = useCallback(() => {
    setPlaying(true);
  }, []);

  const handleOpenExternal = useCallback(() => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }, [url]);

  if (!videoId) return null;

  return (
    <NodeViewWrapper
      className="youtube-block-wrapper my-3"
      data-type="youtube-block"
      contentEditable={false}
    >
      <div
        className="overflow-hidden rounded-xl border"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border)",
          maxWidth: "640px",
        }}
      >
        {/* Video area */}
        {playing ? (
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
              title={title ?? "YouTube video"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ border: "none" }}
            />
          </div>
        ) : (
          <div
            className="group relative w-full cursor-pointer overflow-hidden"
            style={{ paddingBottom: "56.25%" }}
            onClick={handlePlay}
          >
            {/* Thumbnail */}
            <img
              src={effectiveThumbnail}
              alt={title ?? "YouTube thumbnail"}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              onError={() => setThumbError(true)}
            />

            {/* Dark overlay */}
            <div
              className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-30"
              style={{ backgroundColor: "#000" }}
            />

            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110"
                style={{ backgroundColor: "#ff0000ee" }}
              >
                <Play
                  size={28}
                  fill="white"
                  style={{ color: "white", marginLeft: "3px" }}
                />
              </div>
            </div>

            {/* Duration badge area — placeholder for future */}
          </div>
        )}

        {/* Metadata footer */}
        <div className="flex items-start gap-3 px-4 py-3">
          {/* YouTube icon */}
          <div className="mt-0.5 shrink-0">
            <Youtube size={18} style={{ color: "#ff0000" }} />
          </div>

          <div className="min-w-0 flex-1">
            {/* Title */}
            {metaLoading ? (
              <div className="flex items-center gap-1.5">
                <Loader2
                  size={12}
                  className="animate-spin"
                  style={{ color: "var(--text-tertiary)" }}
                />
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {t("editor.youtube.loading_meta")}
                </span>
              </div>
            ) : (
              <p
                className="line-clamp-2 text-sm font-medium leading-snug"
                style={{ color: "var(--text-primary)" }}
              >
                {title ?? t("editor.youtube.untitled")}
              </p>
            )}

            {/* Author */}
            {authorName && !metaLoading && (
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--text-tertiary)" }}
              >
                {authorName}
              </p>
            )}
          </div>

          {/* Open externally */}
          <button
            onClick={handleOpenExternal}
            title={t("editor.youtube.open_external")}
            className="shrink-0 rounded p-1 transition-colors hover:bg-[var(--bg-tertiary)]"
            style={{ color: "var(--text-tertiary)" }}
          >
            <ExternalLink size={14} />
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

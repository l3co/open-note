import { Node, mergeAttributes, ReactNodeViewRenderer } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { YoutubeBlockNodeView } from "./YoutubeBlockNodeView";

export function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function isYoutubeUrl(url: string): boolean {
  return extractYoutubeId(url) !== null;
}

export const YoutubeBlock = Node.create({
  name: "youtubeBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      videoId: { default: null },
      url: { default: null },
      title: { default: null },
      thumbnailUrl: { default: null },
      authorName: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="youtube-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "youtube-block",
        class: "youtube-block-wrapper",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(YoutubeBlockNodeView);
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("youtubeBlockPaste"),
        props: {
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData("text/plain")?.trim();
            if (!text) return false;

            const videoId = extractYoutubeId(text);
            if (!videoId) return false;

            event.preventDefault();
            const { schema, tr } = view.state;
            const node = schema.nodes.youtubeBlock?.create({
              videoId,
              url: text,
              title: null,
              thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
              authorName: null,
            });
            if (!node) return false;
            const transaction = tr.replaceSelectionWith(node);
            view.dispatch(transaction);
            return true;
          },
        },
      }),
    ];
  },
});

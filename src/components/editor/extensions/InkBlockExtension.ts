import { Node, mergeAttributes, ReactNodeViewRenderer } from "@tiptap/react";
import { InkBlockNodeView } from "./InkBlockNodeView";

export const InkBlock = Node.create({
  name: "inkBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      width: { default: null },
      height: { default: 300 },
      strokes: { default: [] },
      svgCache: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="ink-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "ink-block",
        class: "ink-block-wrapper",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InkBlockNodeView);
  },
});

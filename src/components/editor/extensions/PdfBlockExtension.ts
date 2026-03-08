import { Node, mergeAttributes } from "@tiptap/react";

export const PdfBlock = Node.create({
  name: "pdfBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      totalPages: { default: 0 },
      displayMode: { default: "continuous" },
      currentPage: { default: 1 },
      scale: { default: 1.5 },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="pdf-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "pdf-block",
        class: "pdf-block-wrapper",
      }),
    ];
  },
});

import { describe, it, expect } from "vitest";
import { blocksToTiptap, tiptapToBlocks } from "@/lib/serialization";
import type { Block } from "@/types/bindings/Block";
import type { JSONContent } from "@tiptap/react";

describe("blocksToTiptap", () => {
  it("returns empty paragraph for empty blocks", () => {
    const result = blocksToTiptap([]);
    expect(result).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });

  it("converts a text block with tiptap_json content", () => {
    const blocks: Block[] = [
      {
        type: "text",
        id: "b1",
        order: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        content: {
          tiptap_json: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Hello world" }],
              },
            ],
          },
        },
      },
    ];

    const result = blocksToTiptap(blocks);
    expect(result.type).toBe("doc");
    expect(result.content).toHaveLength(1);
    expect(result.content![0].type).toBe("paragraph");
  });

  it("converts divider blocks to horizontalRule", () => {
    const blocks: Block[] = [
      {
        type: "divider",
        id: "d1",
        order: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ];

    const result = blocksToTiptap(blocks);
    expect(result.content).toHaveLength(1);
    expect(result.content![0].type).toBe("horizontalRule");
  });

  it("sorts blocks by order", () => {
    const blocks: Block[] = [
      {
        type: "text",
        id: "b2",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        content: {
          tiptap_json: {
            type: "doc",
            content: [
              { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Second" }] },
            ],
          },
        },
      },
      {
        type: "text",
        id: "b1",
        order: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        content: {
          tiptap_json: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "First" }] },
            ],
          },
        },
      },
    ];

    const result = blocksToTiptap(blocks);
    expect(result.content).toHaveLength(2);
    expect(result.content![0].type).toBe("paragraph");
    expect(result.content![1].type).toBe("heading");
  });
});

describe("tiptapToBlocks", () => {
  it("converts a simple paragraph to a text block", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello" }],
        },
      ],
    };

    const blocks = tiptapToBlocks(doc, []);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
    if (blocks[0].type === "text") {
      expect(blocks[0].content.tiptap_json.content).toHaveLength(1);
    }
  });

  it("converts horizontalRule to divider block", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Before" }] },
        { type: "horizontalRule" },
        { type: "paragraph", content: [{ type: "text", text: "After" }] },
      ],
    };

    const blocks = tiptapToBlocks(doc, []);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe("text");
    expect(blocks[1].type).toBe("divider");
    expect(blocks[2].type).toBe("text");
  });

  it("preserves existing block ids when possible", () => {
    const existingBlocks: Block[] = [
      {
        type: "text",
        id: "existing-id",
        order: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        content: {
          tiptap_json: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Old" }] }],
          },
        },
      },
    ];

    const doc: JSONContent = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Updated" }] },
      ],
    };

    const blocks = tiptapToBlocks(doc, existingBlocks);
    expect(blocks[0].id).toBe("existing-id");
  });

  it("preserves non-text blocks from existing", () => {
    const existingBlocks: Block[] = [
      {
        type: "image",
        id: "img-1",
        order: 1,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        src: "assets/photo.png",
        alt: null,
        width: null,
        height: null,
      },
    ];

    const doc: JSONContent = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Text" }] },
      ],
    };

    const blocks = tiptapToBlocks(doc, existingBlocks);
    expect(blocks).toHaveLength(2);
    expect(blocks[1].type).toBe("image");
  });

  it("handles codeBlock nodes in tiptap content", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "javascript" },
          content: [{ type: "text", text: "const x = 1;" }],
        },
      ],
    };

    const blocks = tiptapToBlocks(doc, []);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
    if (blocks[0].type === "text") {
      const nodes = blocks[0].content.tiptap_json.content;
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe("codeBlock");
      expect(nodes[0].attrs.language).toBe("javascript");
    }
  });

  it("handles table nodes in tiptap content", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "H1" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "H2" }] }] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "C1" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "C2" }] }] },
              ],
            },
          ],
        },
      ],
    };

    const blocks = tiptapToBlocks(doc, []);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
    if (blocks[0].type === "text") {
      expect(blocks[0].content.tiptap_json.content[0].type).toBe("table");
    }
  });

  it("handles taskList nodes in tiptap content", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: true },
              content: [{ type: "paragraph", content: [{ type: "text", text: "Done" }] }],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [{ type: "paragraph", content: [{ type: "text", text: "Todo" }] }],
            },
          ],
        },
      ],
    };

    const blocks = tiptapToBlocks(doc, []);
    expect(blocks).toHaveLength(1);
    if (blocks[0].type === "text") {
      const taskList = blocks[0].content.tiptap_json.content[0];
      expect(taskList.type).toBe("taskList");
      expect(taskList.content).toHaveLength(2);
    }
  });

  it("handles callout nodes in tiptap content", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "callout",
          attrs: { variant: "warning" },
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Be careful!" }] },
          ],
        },
      ],
    };

    const blocks = tiptapToBlocks(doc, []);
    expect(blocks).toHaveLength(1);
    if (blocks[0].type === "text") {
      const callout = blocks[0].content.tiptap_json.content[0];
      expect(callout.type).toBe("callout");
      expect(callout.attrs.variant).toBe("warning");
    }
  });

  it("roundtrips advanced block types through serialization", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "intro" }] },
        { type: "codeBlock", attrs: { language: "rust" }, content: [{ type: "text", text: "fn main() {}" }] },
        { type: "horizontalRule" },
        { type: "callout", attrs: { variant: "info" }, content: [{ type: "paragraph", content: [{ type: "text", text: "Note" }] }] },
      ],
    };

    const blocks = tiptapToBlocks(doc, []);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe("text");
    expect(blocks[1].type).toBe("divider");
    expect(blocks[2].type).toBe("text");

    const tiptap = blocksToTiptap(blocks);
    expect(tiptap.content).toHaveLength(4);
    expect(tiptap.content![0].type).toBe("paragraph");
    expect(tiptap.content![1].type).toBe("codeBlock");
    expect(tiptap.content![2].type).toBe("horizontalRule");
    expect(tiptap.content![3].type).toBe("callout");
  });

  it("handles inkBlock nodes in tiptap content", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "inkBlock",
          attrs: { width: null, height: 300, strokes: [], svgCache: null },
        },
      ],
    };

    const blocks = tiptapToBlocks(doc, []);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
    if (blocks[0].type === "text") {
      const node = blocks[0].content.tiptap_json.content[0];
      expect(node.type).toBe("inkBlock");
      expect(node.attrs.height).toBe(300);
      expect(node.attrs.strokes).toEqual([]);
    }
  });

  it("handles pdfBlock nodes in tiptap content", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "pdfBlock",
          attrs: { src: "assets/doc.pdf", totalPages: 5, displayMode: "continuous", currentPage: 1, scale: 1.5 },
        },
      ],
    };

    const blocks = tiptapToBlocks(doc, []);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
    if (blocks[0].type === "text") {
      const node = blocks[0].content.tiptap_json.content[0];
      expect(node.type).toBe("pdfBlock");
      expect(node.attrs.src).toBe("assets/doc.pdf");
      expect(node.attrs.totalPages).toBe(5);
    }
  });

  it("roundtrips inkBlock and pdfBlock through serialization", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Before" }] },
        { type: "inkBlock", attrs: { width: null, height: 400, strokes: [], svgCache: null } },
        { type: "pdfBlock", attrs: { src: "assets/test.pdf", totalPages: 3, displayMode: "single", currentPage: 2, scale: 1.0 } },
      ],
    };

    const blocks = tiptapToBlocks(doc, []);
    expect(blocks).toHaveLength(1);

    const tiptap = blocksToTiptap(blocks);
    expect(tiptap.content).toHaveLength(3);
    expect(tiptap.content![0].type).toBe("paragraph");
    expect(tiptap.content![1].type).toBe("inkBlock");
    expect(tiptap.content![1].attrs?.height).toBe(400);
    expect(tiptap.content![2].type).toBe("pdfBlock");
    expect(tiptap.content![2].attrs?.src).toBe("assets/test.pdf");
  });

  it("roundtrips correctly: blocks -> tiptap -> blocks", () => {
    const original: Block[] = [
      {
        type: "text",
        id: "b1",
        order: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        content: {
          tiptap_json: {
            type: "doc",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
              { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
            ],
          },
        },
      },
    ];

    const tiptap = blocksToTiptap(original);
    const roundtripped = tiptapToBlocks(tiptap, original);

    expect(roundtripped).toHaveLength(1);
    expect(roundtripped[0].type).toBe("text");
    expect(roundtripped[0].id).toBe("b1");
    if (roundtripped[0].type === "text") {
      expect(roundtripped[0].content.tiptap_json.content).toHaveLength(2);
    }
  });
});

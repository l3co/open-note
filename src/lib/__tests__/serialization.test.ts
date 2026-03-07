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

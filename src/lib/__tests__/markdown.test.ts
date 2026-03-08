import { describe, it, expect } from "vitest";
import { tiptapToMarkdown, markdownToTiptap } from "@/lib/markdown";
import type { JSONContent } from "@tiptap/react";

describe("tiptapToMarkdown", () => {
  it("serializes empty doc", () => {
    const doc: JSONContent = { type: "doc", content: [] };
    expect(tiptapToMarkdown(doc)).toBe("");
  });

  it("serializes paragraph", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello world" }] },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe("Hello world");
  });

  it("serializes headings", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Title" }],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Sub" }],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe("# Title\n\n### Sub");
  });

  it("serializes bold and italic marks", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: " and " },
            { type: "text", text: "italic", marks: [{ type: "italic" }] },
          ],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe("**bold** and *italic*");
  });

  it("serializes strike and code marks", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "deleted", marks: [{ type: "strike" }] },
            { type: "text", text: " " },
            { type: "text", text: "code", marks: [{ type: "code" }] },
          ],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe("~~deleted~~ `code`");
  });

  it("serializes links", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "click",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
          ],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe("[click](https://example.com)");
  });

  it("serializes underline with HTML comments", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "underlined",
              marks: [{ type: "underline" }],
            },
          ],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe(
      "<!-- opn:u -->underlined<!-- /opn:u -->",
    );
  });

  it("serializes bullet list", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "one" }] },
              ],
            },
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "two" }] },
              ],
            },
          ],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe("- one\n- two");
  });

  it("serializes ordered list", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "first" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "second" }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe("1. first\n2. second");
  });

  it("serializes task list", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: true },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "done" }],
                },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "todo" }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe("- [x] done\n- [ ] todo");
  });

  it("serializes blockquote", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "quoted text" }],
            },
          ],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe("> quoted text");
  });

  it("serializes code block", () => {
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
    expect(tiptapToMarkdown(doc)).toBe("```javascript\nconst x = 1;\n```");
  });

  it("serializes horizontal rule", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [{ type: "horizontalRule" }],
    };
    expect(tiptapToMarkdown(doc)).toBe("---");
  });

  it("serializes image", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "photo.png", alt: "My photo" } },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe("![My photo](photo.png)");
  });

  it("serializes table", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "A" }],
                    },
                  ],
                },
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "B" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "1" }],
                    },
                  ],
                },
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "2" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const md = tiptapToMarkdown(doc);
    expect(md).toContain("| A | B |");
    expect(md).toContain("| --- | --- |");
    expect(md).toContain("| 1 | 2 |");
  });

  it("serializes callout with variant", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "callout",
          attrs: { variant: "warning" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Watch out!" }],
            },
          ],
        },
      ],
    };
    const md = tiptapToMarkdown(doc);
    expect(md).toContain('<!-- opn:callout variant="warning" -->');
    expect(md).toContain("Watch out!");
    expect(md).toContain("<!-- /opn:callout -->");
  });
});

describe("markdownToTiptap", () => {
  it("parses empty string", () => {
    const doc = markdownToTiptap("");
    expect(doc.type).toBe("doc");
    expect(doc.content).toHaveLength(1);
    expect(doc.content![0]!.type).toBe("paragraph");
  });

  it("parses paragraph", () => {
    const doc = markdownToTiptap("Hello world");
    expect(doc.content).toHaveLength(1);
    expect(doc.content![0]!.type).toBe("paragraph");
  });

  it("parses headings", () => {
    const doc = markdownToTiptap("# Title\n\n### Sub");
    expect(doc.content).toHaveLength(2);
    expect(doc.content![0]!.type).toBe("heading");
    expect(doc.content![0]!.attrs!.level).toBe(1);
    expect(doc.content![1]!.type).toBe("heading");
    expect(doc.content![1]!.attrs!.level).toBe(3);
  });

  it("parses bold and italic", () => {
    const doc = markdownToTiptap("**bold** and *italic*");
    const content = doc.content![0]!.content!;
    expect(content.some((n) => n.marks?.some((m) => m.type === "bold"))).toBe(
      true,
    );
    expect(content.some((n) => n.marks?.some((m) => m.type === "italic"))).toBe(
      true,
    );
  });

  it("parses code block", () => {
    const doc = markdownToTiptap("```rust\nfn main() {}\n```");
    expect(doc.content).toHaveLength(1);
    expect(doc.content![0]!.type).toBe("codeBlock");
    expect(doc.content![0]!.attrs!.language).toBe("rust");
  });

  it("parses horizontal rule", () => {
    const doc = markdownToTiptap("---");
    expect(doc.content![0]!.type).toBe("horizontalRule");
  });

  it("parses bullet list", () => {
    const doc = markdownToTiptap("- one\n- two\n- three");
    expect(doc.content).toHaveLength(1);
    expect(doc.content![0]!.type).toBe("bulletList");
    expect(doc.content![0]!.content).toHaveLength(3);
  });

  it("parses ordered list", () => {
    const doc = markdownToTiptap("1. first\n2. second");
    expect(doc.content).toHaveLength(1);
    expect(doc.content![0]!.type).toBe("orderedList");
    expect(doc.content![0]!.content).toHaveLength(2);
  });

  it("parses task list", () => {
    const doc = markdownToTiptap("- [x] done\n- [ ] todo");
    expect(doc.content).toHaveLength(1);
    expect(doc.content![0]!.type).toBe("taskList");
    expect(doc.content![0]!.content).toHaveLength(2);
    expect(doc.content![0]!.content![0]!.attrs!.checked).toBe(true);
    expect(doc.content![0]!.content![1]!.attrs!.checked).toBe(false);
  });

  it("parses blockquote", () => {
    const doc = markdownToTiptap("> quoted text");
    expect(doc.content).toHaveLength(1);
    expect(doc.content![0]!.type).toBe("blockquote");
  });

  it("parses image", () => {
    const doc = markdownToTiptap("![alt text](photo.png)");
    expect(doc.content).toHaveLength(1);
    expect(doc.content![0]!.type).toBe("image");
    expect(doc.content![0]!.attrs!.src).toBe("photo.png");
    expect(doc.content![0]!.attrs!.alt).toBe("alt text");
  });

  it("parses table", () => {
    const md = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const doc = markdownToTiptap(md);
    expect(doc.content).toHaveLength(1);
    expect(doc.content![0]!.type).toBe("table");
    expect(doc.content![0]!.content).toHaveLength(2);
  });

  it("parses callout HTML comments", () => {
    const md =
      '<!-- opn:callout variant="info" -->\nImportant note\n<!-- /opn:callout -->';
    const doc = markdownToTiptap(md);
    expect(doc.content).toHaveLength(1);
    expect(doc.content![0]!.type).toBe("callout");
    expect(doc.content![0]!.attrs!.variant).toBe("info");
  });

  it("parses inline link", () => {
    const doc = markdownToTiptap("[click](https://example.com)");
    const content = doc.content![0]!.content!;
    const linkNode = content.find((n) =>
      n.marks?.some((m) => m.type === "link"),
    );
    expect(linkNode).toBeDefined();
    expect(linkNode!.marks![0]!.attrs!.href).toBe("https://example.com");
  });

  it("parses strikethrough", () => {
    const doc = markdownToTiptap("~~deleted~~");
    const content = doc.content![0]!.content!;
    expect(content.some((n) => n.marks?.some((m) => m.type === "strike"))).toBe(
      true,
    );
  });

  it("parses inline code", () => {
    const doc = markdownToTiptap("`const x`");
    const content = doc.content![0]!.content!;
    expect(content.some((n) => n.marks?.some((m) => m.type === "code"))).toBe(
      true,
    );
  });
});

describe("roundtrip: tiptap → markdown → tiptap", () => {
  it("preserves heading", () => {
    const original: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Title" }],
        },
      ],
    };
    const md = tiptapToMarkdown(original);
    const result = markdownToTiptap(md);
    expect(result.content![0]!.type).toBe("heading");
    expect(result.content![0]!.attrs!.level).toBe(2);
  });

  it("preserves code block with language", () => {
    const original: JSONContent = {
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "python" },
          content: [{ type: "text", text: "print('hi')" }],
        },
      ],
    };
    const md = tiptapToMarkdown(original);
    const result = markdownToTiptap(md);
    expect(result.content![0]!.type).toBe("codeBlock");
    expect(result.content![0]!.attrs!.language).toBe("python");
  });

  it("preserves callout with variant", () => {
    const original: JSONContent = {
      type: "doc",
      content: [
        {
          type: "callout",
          attrs: { variant: "warning" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Careful!" }],
            },
          ],
        },
      ],
    };
    const md = tiptapToMarkdown(original);
    const result = markdownToTiptap(md);
    expect(result.content![0]!.type).toBe("callout");
    expect(result.content![0]!.attrs!.variant).toBe("warning");
  });

  it("preserves task list checked state", () => {
    const original: JSONContent = {
      type: "doc",
      content: [
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: true },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "done" }],
                },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "pending" }],
                },
              ],
            },
          ],
        },
      ],
    };
    const md = tiptapToMarkdown(original);
    const result = markdownToTiptap(md);
    expect(result.content![0]!.content![0]!.attrs!.checked).toBe(true);
    expect(result.content![0]!.content![1]!.attrs!.checked).toBe(false);
  });

  it("preserves complex document structure", () => {
    const original: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Title" }],
        },
        { type: "paragraph", content: [{ type: "text", text: "Intro text" }] },
        {
          type: "codeBlock",
          attrs: { language: "javascript" },
          content: [{ type: "text", text: "const x = 1;" }],
        },
        { type: "horizontalRule" },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "item" }],
                },
              ],
            },
          ],
        },
      ],
    };
    const md = tiptapToMarkdown(original);
    const result = markdownToTiptap(md);
    expect(result.content!.length).toBeGreaterThanOrEqual(5);
    expect(result.content![0]!.type).toBe("heading");
    expect(result.content![1]!.type).toBe("paragraph");
    expect(result.content![2]!.type).toBe("codeBlock");
    expect(result.content![3]!.type).toBe("horizontalRule");
    expect(result.content![4]!.type).toBe("bulletList");
  });
});

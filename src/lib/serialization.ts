import type { JSONContent } from "@tiptap/react";
import type { Block } from "@/types/bindings/Block";

export function blocksToTiptap(blocks: Block[]): JSONContent {
  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  const content: JSONContent[] = [];

  for (const block of sorted) {
    if (block.type === "text") {
      const tiptapJson = block.content?.tiptap_json;
      if (tiptapJson && typeof tiptapJson === "object" && tiptapJson.content) {
        content.push(...tiptapJson.content);
      }
    } else if (block.type === "divider") {
      content.push({ type: "horizontalRule" });
    }
  }

  if (content.length === 0) {
    content.push({ type: "paragraph" });
  }

  return { type: "doc", content };
}

export function tiptapToBlocks(
  doc: JSONContent,
  existingBlocks: Block[],
): Block[] {
  const now = new Date().toISOString();
  const firstText = existingBlocks.find((b) => b.type === "text");
  const baseId = firstText?.id ?? crypto.randomUUID();
  const baseCreatedAt = firstText?.created_at ?? now;

  const textContent: JSONContent[] = [];
  const result: Block[] = [];
  let order = 0;

  const flushText = () => {
    if (textContent.length === 0) return;
    result.push({
      type: "text",
      id: order === 0 ? baseId : crypto.randomUUID(),
      order,
      created_at: order === 0 ? baseCreatedAt : now,
      updated_at: now,
      content: {
        tiptap_json: {
          type: "doc",
          content: [...textContent],
        },
      },
    });
    textContent.length = 0;
    order++;
  };

  for (const node of doc.content ?? []) {
    if (node.type === "horizontalRule") {
      flushText();
      const existingDivider = existingBlocks.find(
        (b) => b.type === "divider" && b.order === order,
      );
      result.push({
        type: "divider",
        id: existingDivider?.id ?? crypto.randomUUID(),
        order,
        created_at: existingDivider?.created_at ?? now,
        updated_at: now,
      });
      order++;
    } else {
      textContent.push(node);
    }
  }

  flushText();

  const nonTextBlocks = existingBlocks.filter(
    (b) => b.type !== "text" && b.type !== "divider",
  );
  for (const block of nonTextBlocks) {
    result.push({ ...block, order: order++ });
  }

  return result;
}

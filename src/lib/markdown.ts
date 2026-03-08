import type { JSONContent } from "@tiptap/react";

export function tiptapToMarkdown(doc: JSONContent): string {
  if (!doc.content) return "";
  return doc.content.map((node) => serializeNode(node)).join("\n\n");
}

function serializeNode(node: JSONContent): string {
  switch (node.type) {
    case "heading":
      return serializeHeading(node);
    case "paragraph":
      return serializeInline(node.content);
    case "bulletList":
      return serializeList(node, "bullet");
    case "orderedList":
      return serializeList(node, "ordered");
    case "taskList":
      return serializeTaskList(node);
    case "blockquote":
      return serializeBlockquote(node);
    case "codeBlock":
      return serializeCodeBlock(node);
    case "horizontalRule":
      return "---";
    case "table":
      return serializeTable(node);
    case "image":
      return serializeImage(node);
    case "callout":
      return serializeCallout(node);
    default:
      return serializeInline(node.content);
  }
}

function serializeHeading(node: JSONContent): string {
  const level = (node.attrs?.level as number) ?? 1;
  const prefix = "#".repeat(level);
  return `${prefix} ${serializeInline(node.content)}`;
}

function serializeInline(content?: JSONContent[]): string {
  if (!content) return "";
  return content.map((child) => serializeInlineNode(child)).join("");
}

function serializeInlineNode(node: JSONContent): string {
  if (node.type === "text") {
    let text = node.text ?? "";
    const marks = node.marks ?? [];
    for (const mark of marks) {
      switch (mark.type) {
        case "bold":
          text = `**${text}**`;
          break;
        case "italic":
          text = `*${text}*`;
          break;
        case "strike":
          text = `~~${text}~~`;
          break;
        case "code":
          text = `\`${text}\``;
          break;
        case "underline":
          text = `<!-- opn:u -->${text}<!-- /opn:u -->`;
          break;
        case "link":
          text = `[${text}](${mark.attrs?.href ?? ""})`;
          break;
      }
    }
    return text;
  }
  if (node.type === "hardBreak") return "  \n";
  return "";
}

function serializeList(
  node: JSONContent,
  kind: "bullet" | "ordered",
  indent = 0,
): string {
  if (!node.content) return "";
  const prefix = "  ".repeat(indent);
  return node.content
    .map((item, i) => {
      const marker = kind === "bullet" ? "-" : `${i + 1}.`;
      const parts: string[] = [];
      for (const child of item.content ?? []) {
        if (child.type === "paragraph") {
          parts.push(`${prefix}${marker} ${serializeInline(child.content)}`);
        } else if (
          child.type === "bulletList" ||
          child.type === "orderedList"
        ) {
          parts.push(
            serializeList(
              child,
              child.type === "bulletList" ? "bullet" : "ordered",
              indent + 1,
            ),
          );
        }
      }
      return parts.join("\n");
    })
    .join("\n");
}

function serializeTaskList(node: JSONContent, indent = 0): string {
  if (!node.content) return "";
  const prefix = "  ".repeat(indent);
  return node.content
    .map((item) => {
      const checked = item.attrs?.checked ? "x" : " ";
      const parts: string[] = [];
      for (const child of item.content ?? []) {
        if (child.type === "paragraph") {
          parts.push(
            `${prefix}- [${checked}] ${serializeInline(child.content)}`,
          );
        } else if (child.type === "taskList") {
          parts.push(serializeTaskList(child, indent + 1));
        }
      }
      return parts.join("\n");
    })
    .join("\n");
}

function serializeBlockquote(node: JSONContent): string {
  if (!node.content) return "> ";
  return node.content
    .map((child) => {
      const inner = serializeNode(child);
      return inner
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    })
    .join("\n");
}

function serializeCodeBlock(node: JSONContent): string {
  const lang = (node.attrs?.language as string) ?? "";
  const code = node.content?.map((c) => c.text ?? "").join("") ?? "";
  return `\`\`\`${lang}\n${code}\n\`\`\``;
}

function serializeTable(node: JSONContent): string {
  if (!node.content) return "";
  const rows = node.content.filter((r) => r.type === "tableRow");
  if (rows.length === 0) return "";

  const serialized = rows.map((row) =>
    (row.content ?? []).map((cell) => {
      const inner = (cell.content ?? [])
        .map((c) => serializeInline(c.content))
        .join(" ");
      return inner;
    }),
  );

  const lines: string[] = [];
  for (let i = 0; i < serialized.length; i++) {
    const cells = serialized[i]!;
    lines.push(`| ${cells.join(" | ")} |`);
    if (i === 0) {
      lines.push(`| ${cells.map(() => "---").join(" | ")} |`);
    }
  }
  return lines.join("\n");
}

function serializeImage(node: JSONContent): string {
  const src = (node.attrs?.src as string) ?? "";
  const alt = (node.attrs?.alt as string) ?? "";
  return `![${alt}](${src})`;
}

function serializeCallout(node: JSONContent): string {
  const variant = (node.attrs?.variant as string) ?? "info";
  const inner = (node.content ?? []).map((c) => serializeNode(c)).join("\n\n");
  return `<!-- opn:callout variant="${variant}" -->\n${inner}\n<!-- /opn:callout -->`;
}

export function markdownToTiptap(md: string): JSONContent {
  const lines = md.split("\n");
  const content: JSONContent[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (line.startsWith("<!-- opn:callout")) {
      const variantMatch = line.match(/variant="([^"]+)"/);
      const variant = variantMatch?.[1] ?? "info";
      const calloutLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith("<!-- /opn:callout")) {
        calloutLines.push(lines[i]!);
        i++;
      }
      i++;
      const innerMd = calloutLines.join("\n");
      const innerDoc = markdownToTiptap(innerMd);
      content.push({
        type: "callout",
        attrs: { variant },
        content: innerDoc.content ?? [{ type: "paragraph" }],
      });
      continue;
    }

    if (line === "---" || line === "***" || line === "___") {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1]!.length;
      content.push({
        type: "heading",
        attrs: { level },
        content: parseInline(headingMatch[2]!),
      });
      i++;
      continue;
    }

    if (line.match(/^```/)) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.match(/^```\s*$/)) {
        codeLines.push(lines[i]!);
        i++;
      }
      i++;
      content.push({
        type: "codeBlock",
        attrs: { language: lang || null },
        content: [{ type: "text", text: codeLines.join("\n") }],
      });
      continue;
    }

    if (line.startsWith("| ")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i]!.startsWith("| ")) {
        tableLines.push(lines[i]!);
        i++;
      }
      content.push(parseTable(tableLines));
      continue;
    }

    if (line.match(/^\s*- \[[ x]\] /)) {
      const items: JSONContent[] = [];
      while (i < lines.length && lines[i]!.match(/^\s*- \[[ x]\] /)) {
        const taskMatch = lines[i]!.match(/^\s*- \[([ x])\] (.*)$/);
        if (taskMatch) {
          items.push({
            type: "taskItem",
            attrs: { checked: taskMatch[1] === "x" },
            content: [
              { type: "paragraph", content: parseInline(taskMatch[2]!) },
            ],
          });
        }
        i++;
      }
      content.push({ type: "taskList", content: items });
      continue;
    }

    if (line.match(/^\s*[-*+] /)) {
      const items: JSONContent[] = [];
      while (i < lines.length && lines[i]!.match(/^\s*[-*+] /)) {
        const text = lines[i]!.replace(/^\s*[-*+] /, "");
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInline(text) }],
        });
        i++;
      }
      content.push({ type: "bulletList", content: items });
      continue;
    }

    if (line.match(/^\s*\d+\.\s/)) {
      const items: JSONContent[] = [];
      while (i < lines.length && lines[i]!.match(/^\s*\d+\.\s/)) {
        const text = lines[i]!.replace(/^\s*\d+\.\s/, "");
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInline(text) }],
        });
        i++;
      }
      content.push({ type: "orderedList", content: items });
      continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]!.startsWith("> ")) {
        quoteLines.push(lines[i]!.slice(2));
        i++;
      }
      const innerMd = quoteLines.join("\n");
      const innerDoc = markdownToTiptap(innerMd);
      content.push({
        type: "blockquote",
        content: innerDoc.content ?? [{ type: "paragraph" }],
      });
      continue;
    }

    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      content.push({
        type: "image",
        attrs: { src: imgMatch[2], alt: imgMatch[1] || null },
      });
      i++;
      continue;
    }

    content.push({
      type: "paragraph",
      content: parseInline(line),
    });
    i++;
  }

  if (content.length === 0) {
    content.push({ type: "paragraph" });
  }

  return { type: "doc", content };
}

function parseInline(text: string): JSONContent[] {
  if (!text) return [];

  const result: JSONContent[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    let earliest = remaining.length;
    let matchType = "";
    let matchData: RegExpMatchArray | null = null;

    const patterns: [string, RegExp][] = [
      ["boldItalic", /\*\*\*(.+?)\*\*\*/],
      ["bold", /\*\*(.+?)\*\*/],
      ["italic", /\*(.+?)\*/],
      ["strike", /~~(.+?)~~/],
      ["code", /`([^`]+)`/],
      ["link", /\[([^\]]+)\]\(([^)]+)\)/],
      ["underlineOpen", /<!-- opn:u -->/],
    ];

    for (const [type, pattern] of patterns) {
      const m = remaining.match(pattern);
      if (m && m.index !== undefined && m.index < earliest) {
        earliest = m.index;
        matchType = type;
        matchData = m;
      }
    }

    if (!matchData || matchData.index === undefined) {
      if (remaining) result.push({ type: "text", text: remaining });
      break;
    }

    if (matchData.index > 0) {
      result.push({ type: "text", text: remaining.slice(0, matchData.index) });
    }

    switch (matchType) {
      case "boldItalic":
        result.push({
          type: "text",
          text: matchData[1],
          marks: [{ type: "bold" }, { type: "italic" }],
        });
        break;
      case "bold":
        result.push({
          type: "text",
          text: matchData[1],
          marks: [{ type: "bold" }],
        });
        break;
      case "italic":
        result.push({
          type: "text",
          text: matchData[1],
          marks: [{ type: "italic" }],
        });
        break;
      case "strike":
        result.push({
          type: "text",
          text: matchData[1],
          marks: [{ type: "strike" }],
        });
        break;
      case "code":
        result.push({
          type: "text",
          text: matchData[1],
          marks: [{ type: "code" }],
        });
        break;
      case "link":
        result.push({
          type: "text",
          text: matchData[1],
          marks: [{ type: "link", attrs: { href: matchData[2] } }],
        });
        break;
      case "underlineOpen": {
        const closeTag = "<!-- /opn:u -->";
        const afterOpen = remaining.slice(
          matchData.index + matchData[0].length,
        );
        const closeIdx = afterOpen.indexOf(closeTag);
        if (closeIdx !== -1) {
          const innerText = afterOpen.slice(0, closeIdx);
          result.push({
            type: "text",
            text: innerText,
            marks: [{ type: "underline" }],
          });
          remaining = afterOpen.slice(closeIdx + closeTag.length);
          continue;
        }
        result.push({ type: "text", text: matchData[0] });
        break;
      }
    }

    remaining = remaining.slice(matchData.index + matchData[0].length);
  }

  return result.length > 0 ? result : [{ type: "text", text: "" }];
}

function parseTable(lines: string[]): JSONContent {
  const rows: string[][] = [];
  for (let i = 0; i < lines.length; i++) {
    const cells = lines[i]!.split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (i === 1 && cells.every((c) => c.match(/^-+$/))) continue;
    rows.push(cells);
  }

  const tableContent: JSONContent[] = rows.map((cells, rowIdx) => ({
    type: "tableRow",
    content: cells.map((cell) => ({
      type: rowIdx === 0 ? "tableHeader" : "tableCell",
      content: [{ type: "paragraph", content: parseInline(cell) }],
    })),
  }));

  return { type: "table", content: tableContent };
}

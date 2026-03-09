import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  CheckSquare,
  Code,
  Table2,
  ImageIcon,
  Info,
  Link,
  Pencil,
  FileText,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import type { TFunction } from "i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { importAsset, importPdf } from "@/lib/ipc";
import { useNavigationStore } from "@/stores/useNavigationStore";

interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: "text" | "media" | "structure";
  action: (editor: Editor) => void;
}

function buildCommands(t: TFunction, sectionId: string | null): SlashCommand[] {
  return [
    {
      id: "heading1",
      label: t("editor.slash.heading1"),
      description: t("editor.slash.heading1_desc"),
      icon: <Heading1 size={18} />,
      category: "text",
      action: (editor) =>
        editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      id: "heading2",
      label: t("editor.slash.heading2"),
      description: t("editor.slash.heading2_desc"),
      icon: <Heading2 size={18} />,
      category: "text",
      action: (editor) =>
        editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      id: "heading3",
      label: t("editor.slash.heading3"),
      description: t("editor.slash.heading3_desc"),
      icon: <Heading3 size={18} />,
      category: "text",
      action: (editor) =>
        editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      id: "bulletList",
      label: t("editor.slash.bullet_list"),
      description: t("editor.slash.bullet_list_desc"),
      icon: <List size={18} />,
      category: "text",
      action: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      id: "orderedList",
      label: t("editor.slash.ordered_list"),
      description: t("editor.slash.ordered_list_desc"),
      icon: <ListOrdered size={18} />,
      category: "text",
      action: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      id: "checklist",
      label: t("editor.slash.checklist"),
      description: t("editor.slash.checklist_desc"),
      icon: <CheckSquare size={18} />,
      category: "text",
      action: (editor) => editor.chain().focus().toggleTaskList().run(),
    },
    {
      id: "blockquote",
      label: t("editor.slash.blockquote"),
      description: t("editor.slash.blockquote_desc"),
      icon: <Quote size={18} />,
      category: "text",
      action: (editor) => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      id: "code",
      label: t("editor.slash.code"),
      description: t("editor.slash.code_desc"),
      icon: <Code size={18} />,
      category: "structure",
      action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      id: "table",
      label: t("editor.slash.table"),
      description: t("editor.slash.table_desc"),
      icon: <Table2 size={18} />,
      category: "structure",
      action: (editor) =>
        editor
          .chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    },
    {
      id: "callout",
      label: t("editor.slash.callout"),
      description: t("editor.slash.callout_desc"),
      icon: <Info size={18} />,
      category: "structure",
      action: (editor) =>
        editor.chain().focus().setCallout({ variant: "info" }).run(),
    },
    {
      id: "image",
      label: t("editor.slash.image"),
      description: t("editor.slash.image_desc"),
      icon: <ImageIcon size={18} />,
      category: "media",
      action: async (editor) => {
        if (!sectionId) return;
        const selected = await open({
          multiple: false,
          filters: [
            {
              name: "Images",
              extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"],
            },
          ],
        });
        if (selected) {
          try {
            const result = await importAsset(sectionId, selected);
            const assetUrl = convertFileSrc(result.absolute_path);
            editor.chain().focus().setImage({ src: assetUrl }).run();
          } catch (err) {
            console.error("[Image] Import failed:", err);
          }
        }
      },
    },
    {
      id: "embed",
      label: t("editor.slash.embed"),
      description: t("editor.slash.embed_desc"),
      icon: <Link size={18} />,
      category: "media",
      action: (editor) => {
        const url = window.prompt(t("editor.slash.embed_desc"));
        if (url) {
          const youtubeMatch = url.match(
            /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
          );
          if (youtubeMatch?.[1]) {
            editor
              .chain()
              .focus()
              .insertContent({
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: `[YouTube: ${url}]`,
                    marks: [{ type: "link", attrs: { href: url } }],
                  },
                ],
              })
              .run();
          } else {
            editor
              .chain()
              .focus()
              .insertContent({
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: url,
                    marks: [{ type: "link", attrs: { href: url } }],
                  },
                ],
              })
              .run();
          }
        }
      },
    },
    {
      id: "pdf",
      label: "PDF",
      description: t("pdf.import"),
      icon: <FileText size={18} />,
      category: "media",
      action: async (editor) => {
        if (!sectionId) return;
        const selected = await open({
          multiple: false,
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        });
        if (selected) {
          try {
            const [, absolutePath, pageCount] = await importPdf(sectionId, selected);
            const assetUrl = convertFileSrc(absolutePath);
            editor
              .chain()
              .focus()
              .insertContent({
                type: "pdfBlock",
                attrs: {
                  src: assetUrl,
                  totalPages: pageCount,
                  displayMode: "continuous",
                  currentPage: 1,
                  scale: 1.5,
                },
              })
              .run();
          } catch (err) {
            console.error("[PDF] Import failed:", err);
          }
        }
      },
    },
    {
      id: "draw",
      label: "Ink",
      description: "Freehand drawing block",
      icon: <Pencil size={18} />,
      category: "media",
      action: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({ type: "inkBlock", attrs: { height: 300 } })
          .run(),
    },
    {
      id: "divider",
      label: t("editor.slash.divider"),
      description: t("editor.slash.divider_desc"),
      icon: <Minus size={18} />,
      category: "structure",
      action: (editor) => editor.chain().focus().setHorizontalRule().run(),
    },
  ];
}

interface SlashCommandMenuProps {
  editor: Editor;
}

export function SlashCommandMenu({ editor }: SlashCommandMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const { t } = useTranslation();
  const sectionId = useNavigationStore((s) => s.selectedSectionId);
  const commands = useMemo(() => buildCommands(t, sectionId), [t, sectionId]);

  const filtered = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.description.toLowerCase().includes(query.toLowerCase()),
  );

  const executeCommand = useCallback(
    (command: SlashCommand) => {
      const { from } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(
        Math.max(0, from - query.length - 1),
        from,
        "",
      );
      const slashPos = textBefore.lastIndexOf("/");
      if (slashPos !== -1) {
        const deleteFrom = from - query.length - 1;
        editor
          .chain()
          .focus()
          .deleteRange({ from: deleteFrom, to: from })
          .run();
      }
      command.action(editor);
      setIsOpen(false);
      setQuery("");
    },
    [editor, query],
  );

  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const { from, empty } = editor.state.selection;
      if (!empty) {
        setIsOpen(false);
        return;
      }

      const textBefore = editor.state.doc.textBetween(
        Math.max(0, from - 50),
        from,
        "",
      );

      const match = textBefore.match(/\/([a-zA-ZÀ-ÿ\s]*)$/);
      if (match) {
        setQuery(match[1] ?? "");
        setSelectedIndex(0);

        const coords = editor.view.coordsAtPos(from);
        const editorRect = editor.view.dom.getBoundingClientRect();
        setPosition({
          top: coords.bottom - editorRect.top + 4,
          left: coords.left - editorRect.left,
        });

        setIsOpen(true);
      } else {
        setIsOpen(false);
        setQuery("");
      }
    };

    editor.on("update", handleUpdate);
    editor.on("selectionUpdate", handleUpdate);

    return () => {
      editor.off("update", handleUpdate);
      editor.off("selectionUpdate", handleUpdate);
    };
  }, [editor]);

  useEffect(() => {
    if (!isOpen || !editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (prev) => (prev - 1 + filtered.length) % filtered.length,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          executeCommand(filtered[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, editor, filtered, selectedIndex, executeCommand]);

  if (!isOpen || filtered.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-64 overflow-hidden rounded-lg border shadow-lg"
      style={{
        top: position.top,
        left: position.left,
        backgroundColor: "var(--bg-primary)",
        borderColor: "var(--border)",
      }}
    >
      <div className="max-h-72 overflow-y-auto p-1">
        {filtered.map((cmd, index) => (
          <button
            key={cmd.id}
            type="button"
            className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left"
            style={{
              backgroundColor:
                index === selectedIndex ? "var(--bg-hover)" : "transparent",
              color: "var(--text-primary)",
            }}
            onMouseEnter={() => setSelectedIndex(index)}
            onClick={() => executeCommand(cmd)}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded border"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              {cmd.icon}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{cmd.label}</div>
              <div
                className="text-xs"
                style={{ color: "var(--text-tertiary)" }}
              >
                {cmd.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

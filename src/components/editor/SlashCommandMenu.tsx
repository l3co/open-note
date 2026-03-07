import { useState, useEffect, useCallback, useRef } from "react";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
} from "lucide-react";
import type { Editor } from "@tiptap/react";

interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: (editor: Editor) => void;
}

const COMMANDS: SlashCommand[] = [
  {
    id: "heading1",
    label: "Heading 1",
    description: "Título grande",
    icon: <Heading1 size={18} />,
    action: (editor) =>
      editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: "heading2",
    label: "Heading 2",
    description: "Subtítulo",
    icon: <Heading2 size={18} />,
    action: (editor) =>
      editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: "heading3",
    label: "Heading 3",
    description: "Subtítulo menor",
    icon: <Heading3 size={18} />,
    action: (editor) =>
      editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: "bulletList",
    label: "Lista",
    description: "Lista com marcadores",
    icon: <List size={18} />,
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: "orderedList",
    label: "Lista numerada",
    description: "Lista ordenada",
    icon: <ListOrdered size={18} />,
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "blockquote",
    label: "Citação",
    description: "Bloco de citação",
    icon: <Quote size={18} />,
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "divider",
    label: "Divisor",
    description: "Linha separadora",
    icon: <Minus size={18} />,
    action: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
];

interface SlashCommandMenuProps {
  editor: Editor;
}

export function SlashCommandMenu({ editor }: SlashCommandMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const filtered = COMMANDS.filter(
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

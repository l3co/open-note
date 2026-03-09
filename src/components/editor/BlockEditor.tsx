import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Typography from "@tiptap/extension-typography";
import CharacterCount from "@tiptap/extension-character-count";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import { common, createLowlight } from "lowlight";
import type { JSONContent, Editor } from "@tiptap/react";
import { FloatingToolbar } from "@/components/editor/FloatingToolbar";
import { SlashCommandMenu } from "@/components/editor/SlashCommandMenu";
import { Callout } from "@/components/editor/extensions/CalloutExtension";
import { InkBlock } from "@/components/editor/extensions/InkBlockExtension";
import { PdfBlock } from "@/components/editor/extensions/PdfBlockExtension";
import { YoutubeBlock } from "@/components/editor/extensions/YoutubeBlockExtension";
import { SpellCheckExtension } from "@/components/editor/extensions/SpellCheckExtension";
import { useUIStore } from "@/stores/useUIStore";

const lowlight = createLowlight(common);

interface BlockEditorProps {
  initialContent: JSONContent;
  onUpdate: (content: JSONContent) => void;
  onEditorReady?: (editor: Editor) => void;
}

export function BlockEditor({
  initialContent,
  onUpdate,
  onEditorReady,
}: BlockEditorProps) {
  const editorConfig = useUIStore((s) => s.editorConfig);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: "plaintext",
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: "editor-table" },
      }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList.configure({
        HTMLAttributes: { class: "editor-task-list" },
      }),
      TaskItem.configure({
        nested: true,
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: { class: "editor-image" },
      }),
      Callout,
      InkBlock,
      PdfBlock,
      YoutubeBlock,
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") {
            return `Heading ${node.attrs.level}`;
          }
          return "Digite '/' para comandos...";
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "editor-link" },
      }),
      Typography,
      CharacterCount,
      SpellCheckExtension.configure({
        language: editorConfig.documentLanguage,
        enabled: editorConfig.spellCheckEnabled,
        debounceMs: 2000,
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor: ed }) => {
      onUpdate(ed.getJSON());
    },
    editorProps: {
      attributes: {
        class: "editor-content",
        spellcheck: editorConfig.spellCheckEnabled ? "true" : "false",
      },
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  if (!editor) return null;

  return (
    <div className="relative">
      <FloatingToolbar editor={editor} />
      <SlashCommandMenu editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

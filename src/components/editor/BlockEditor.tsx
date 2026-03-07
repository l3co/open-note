import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Typography from "@tiptap/extension-typography";
import CharacterCount from "@tiptap/extension-character-count";
import type { JSONContent, Editor } from "@tiptap/react";
import { FloatingToolbar } from "@/components/editor/FloatingToolbar";
import { SlashCommandMenu } from "@/components/editor/SlashCommandMenu";

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
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
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
    ],
    content: initialContent,
    onUpdate: ({ editor: ed }) => {
      onUpdate(ed.getJSON());
    },
    editorProps: {
      attributes: {
        class: "editor-content",
        spellcheck: "true",
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

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link,
  Heading1,
  Heading2,
  Heading3,
  Quote,
} from "lucide-react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { LinkPopover } from "@/components/editor/LinkPopover";

interface FloatingToolbarProps {
  editor: Editor;
}

export function FloatingToolbar({ editor }: FloatingToolbarProps) {
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const { t } = useTranslation();

  const toggleBold = useCallback(() => {
    editor.chain().focus().toggleBold().run();
  }, [editor]);

  const toggleItalic = useCallback(() => {
    editor.chain().focus().toggleItalic().run();
  }, [editor]);

  const toggleUnderline = useCallback(() => {
    editor.chain().focus().toggleUnderline().run();
  }, [editor]);

  const toggleStrike = useCallback(() => {
    editor.chain().focus().toggleStrike().run();
  }, [editor]);

  const toggleCode = useCallback(() => {
    editor.chain().focus().toggleCode().run();
  }, [editor]);

  const toggleHeading = useCallback(
    (level: 1 | 2 | 3) => {
      editor.chain().focus().toggleHeading({ level }).run();
    },
    [editor],
  );

  const toggleBlockquote = useCallback(() => {
    editor.chain().focus().toggleBlockquote().run();
  }, [editor]);

  const handleLinkSubmit = useCallback(
    (url: string) => {
      if (url) {
        editor
          .chain()
          .focus()
          .extendMarkRange("link")
          .setLink({ href: url })
          .run();
      }
      setShowLinkPopover(false);
    },
    [editor],
  );

  const handleLinkRemove = useCallback(() => {
    editor.chain().focus().unsetLink().run();
    setShowLinkPopover(false);
  }, [editor]);

  return (
    <BubbleMenu
      editor={editor}
      className="floating-toolbar"
    >
      <div
        className="flex items-center gap-0.5 rounded-lg border p-1 shadow-lg"
        style={{
          backgroundColor: "var(--bg-primary)",
          borderColor: "var(--border)",
        }}
      >
        <ToolbarButton
          onClick={toggleBold}
          active={editor.isActive("bold")}
          title={`${t("editor.toolbar.bold")} (Cmd+B)`}
        >
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleItalic}
          active={editor.isActive("italic")}
          title={`${t("editor.toolbar.italic")} (Cmd+I)`}
        >
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleUnderline}
          active={editor.isActive("underline")}
          title={`${t("editor.toolbar.underline")} (Cmd+U)`}
        >
          <Underline size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleStrike}
          active={editor.isActive("strike")}
          title={`${t("editor.toolbar.strike")} (Cmd+Shift+S)`}
        >
          <Strikethrough size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={toggleCode}
          active={editor.isActive("code")}
          title={`${t("editor.toolbar.code")} (Cmd+E)`}
        >
          <Code size={14} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          onClick={() => setShowLinkPopover(!showLinkPopover)}
          active={editor.isActive("link")}
          title={`${t("editor.toolbar.link")} (Cmd+K)`}
        >
          <Link size={14} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          onClick={() => toggleHeading(1)}
          active={editor.isActive("heading", { level: 1 })}
          title={t("editor.toolbar.heading1")}
        >
          <Heading1 size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => toggleHeading(2)}
          active={editor.isActive("heading", { level: 2 })}
          title={t("editor.toolbar.heading2")}
        >
          <Heading2 size={14} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => toggleHeading(3)}
          active={editor.isActive("heading", { level: 3 })}
          title={t("editor.toolbar.heading3")}
        >
          <Heading3 size={14} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          onClick={toggleBlockquote}
          active={editor.isActive("blockquote")}
          title={t("editor.toolbar.blockquote")}
        >
          <Quote size={14} />
        </ToolbarButton>
      </div>

      {showLinkPopover && (
        <LinkPopover
          initialUrl={editor.getAttributes("link").href ?? ""}
          onSubmit={handleLinkSubmit}
          onRemove={handleLinkRemove}
          onClose={() => setShowLinkPopover(false)}
        />
      )}
    </BubbleMenu>
  );
}

function ToolbarButton({
  onClick,
  active = false,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded"
      style={{
        backgroundColor: active ? "var(--accent-subtle)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-secondary)",
      }}
      onMouseEnter={(e) => {
        if (!active)
          e.currentTarget.style.backgroundColor = "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active)
          e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {children}
    </button>
  );
}

function Separator() {
  return (
    <div
      className="mx-0.5 h-4 w-px"
      style={{ backgroundColor: "var(--border)" }}
    />
  );
}

import { useTranslation } from "react-i18next";
import {
  Columns2,
  Rows2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";

interface TableToolbarProps {
  editor: Editor;
}

export function TableToolbar({ editor }: TableToolbarProps) {
  const { t } = useTranslation();

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: ed }) => ed.isActive("table")}
    >
      <div
        className="flex items-center gap-0.5 rounded-lg border p-1 shadow-lg"
        style={{
          backgroundColor: "var(--bg-primary)",
          borderColor: "var(--border)",
        }}
      >
        {/* Column actions */}
        <span
          className="flex items-center gap-0.5 px-1"
          style={{ color: "var(--text-tertiary)", fontSize: 11 }}
        >
          <Columns2 size={12} />
        </span>

        <TableButton
          title={t("editor.toolbar.table_add_col_before")}
          onClick={() => editor.chain().focus().addColumnBefore().run()}
        >
          <ChevronLeft size={13} />
          <Columns2 size={13} />
        </TableButton>

        <TableButton
          title={t("editor.toolbar.table_add_col_after")}
          onClick={() => editor.chain().focus().addColumnAfter().run()}
        >
          <Columns2 size={13} />
          <ChevronRight size={13} />
        </TableButton>

        <TableButton
          title={t("editor.toolbar.table_delete_col")}
          onClick={() => editor.chain().focus().deleteColumn().run()}
          danger
        >
          <Columns2 size={13} />
          <Trash2 size={11} />
        </TableButton>

        <Separator />

        {/* Row actions */}
        <span
          className="flex items-center gap-0.5 px-1"
          style={{ color: "var(--text-tertiary)", fontSize: 11 }}
        >
          <Rows2 size={12} />
        </span>

        <TableButton
          title={t("editor.toolbar.table_add_row_before")}
          onClick={() => editor.chain().focus().addRowBefore().run()}
        >
          <ChevronUp size={13} />
          <Rows2 size={13} />
        </TableButton>

        <TableButton
          title={t("editor.toolbar.table_add_row_after")}
          onClick={() => editor.chain().focus().addRowAfter().run()}
        >
          <Rows2 size={13} />
          <ChevronDown size={13} />
        </TableButton>

        <TableButton
          title={t("editor.toolbar.table_delete_row")}
          onClick={() => editor.chain().focus().deleteRow().run()}
          danger
        >
          <Rows2 size={13} />
          <Trash2 size={11} />
        </TableButton>

        <Separator />

        {/* Delete table */}
        <TableButton
          title={t("editor.toolbar.table_delete")}
          onClick={() => editor.chain().focus().deleteTable().run()}
          danger
        >
          <Trash2 size={13} />
        </TableButton>
      </div>
    </BubbleMenu>
  );
}

interface TableButtonProps {
  onClick: () => void;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}

function TableButton({ onClick, title, danger, children }: TableButtonProps) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className="flex items-center gap-0.5 rounded px-1.5 py-1 transition-colors"
      style={{
        color: danger ? "var(--danger)" : "var(--text-secondary)",
        backgroundColor: "transparent",
        border: "none",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor = danger
          ? "rgba(239,68,68,0.08)"
          : "var(--bg-hover)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor =
          "transparent";
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

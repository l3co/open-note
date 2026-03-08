import { useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Editor } from "@tiptap/react";

interface TitleEditorProps {
  title: string;
  onTitleChange: (title: string) => void;
  editorRef?: React.RefObject<Editor | null>;
}

export function TitleEditor({
  title,
  onTitleChange,
  editorRef,
}: TitleEditorProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (divRef.current && divRef.current.textContent !== title) {
      divRef.current.textContent = title;
    }
  }, [title]);

  const handleInput = useCallback(() => {
    if (isComposing.current) return;
    const text = divRef.current?.textContent ?? "";
    onTitleChange(text);
  }, [onTitleChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        editorRef?.current?.commands.focus("start");
      }
    },
    [editorRef],
  );

  const handleBlur = useCallback(() => {
    const text = divRef.current?.textContent?.trim() ?? "";
    if (text !== title) {
      onTitleChange(text);
    }
  }, [title, onTitleChange]);

  return (
    <div
      ref={divRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={t("page.untitled")}
      data-placeholder={t("page.untitled")}
      className="page-title w-full cursor-text border-none text-3xl font-bold outline-none"
      style={{
        color: "var(--text-primary)",
        minHeight: "1.5em",
      }}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      onCompositionStart={() => {
        isComposing.current = true;
      }}
      onCompositionEnd={() => {
        isComposing.current = false;
        handleInput();
      }}
    />
  );
}

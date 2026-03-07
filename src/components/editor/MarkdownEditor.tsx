import { useEffect, useRef, useCallback } from "react";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
} from "@codemirror/language";

interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  theme: "light" | "dark";
}

export function MarkdownEditor({
  content,
  onChange,
  theme,
}: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const createExtensions = useCallback(
    (isDark: boolean) => [
      markdown(),
      keymap.of([...defaultKeymap, indentWithTab]),
      syntaxHighlighting(defaultHighlightStyle),
      cmPlaceholder("Digite Markdown aqui..."),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        "&": {
          fontSize: "14px",
          fontFamily:
            '"SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace',
          backgroundColor: "var(--bg-primary)",
          color: "var(--text-primary)",
          minHeight: "200px",
        },
        ".cm-content": {
          padding: "16px 0",
          caretColor: "var(--accent)",
        },
        ".cm-cursor": {
          borderLeftColor: "var(--accent)",
        },
        ".cm-selectionBackground": {
          backgroundColor: "var(--accent-subtle) !important",
        },
        ".cm-gutters": {
          backgroundColor: "var(--bg-secondary)",
          borderRight: "1px solid var(--border)",
          color: "var(--text-tertiary)",
        },
        ".cm-activeLine": {
          backgroundColor: "var(--bg-hover)",
        },
        ".cm-activeLineGutter": {
          backgroundColor: "var(--bg-hover)",
        },
        "&.cm-focused .cm-selectionBackground": {
          backgroundColor: "var(--accent-subtle) !important",
        },
      }),
      ...(isDark ? [oneDark] : []),
    ],
    [],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: createExtensions(theme === "dark"),
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentContent = view.state.doc.toString();
    if (currentContent !== content) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: content,
        },
      });
    }
  }, [content]);

  return (
    <div
      ref={containerRef}
      className="mx-auto w-full max-w-3xl px-8"
      style={{ minHeight: "200px" }}
    />
  );
}

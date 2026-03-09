import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { checkSpelling } from "@/lib/ipc";
import type { SpellCheckMatch } from "@/types/spellcheck";

export const spellCheckPluginKey = new PluginKey("spellCheck");

interface SpellCheckState {
  decorations: DecorationSet;
  matches: SpellCheckMatch[];
}

export interface SpellCheckOptions {
  language: string;
  enabled: boolean;
  debounceMs: number;
}

export const SpellCheckExtension = Extension.create<SpellCheckOptions>({
  name: "spellCheck",

  addOptions() {
    return {
      language: "pt-BR",
      enabled: true,
      debounceMs: 2000,
    };
  },

  addProseMirrorPlugins() {
    const extensionOptions = this.options;

    return [
      new Plugin<SpellCheckState>({
        key: spellCheckPluginKey,

        state: {
          init() {
            return {
              decorations: DecorationSet.empty,
              matches: [],
            };
          },

          apply(tr, prev) {
            if (tr.docChanged) {
              return {
                decorations: prev.decorations.map(tr.mapping, tr.doc),
                matches: prev.matches,
              };
            }

            const meta = tr.getMeta(spellCheckPluginKey);
            if (meta) {
              return meta as SpellCheckState;
            }

            return prev;
          },
        },

        props: {
          decorations(state) {
            return (
              spellCheckPluginKey.getState(state)?.decorations ??
              DecorationSet.empty
            );
          },
        },

        view(editorView) {
          let debounceTimer: ReturnType<typeof setTimeout> | null = null;
          let lastCheckedText = "";

          const runCheck = async () => {
            if (!extensionOptions.enabled) {
              const tr = editorView.state.tr.setMeta(spellCheckPluginKey, {
                decorations: DecorationSet.empty,
                matches: [],
              });
              editorView.dispatch(tr);
              return;
            }

            const doc = editorView.state.doc;
            const text = doc.textBetween(0, doc.content.size, "\n", "\n");

            if (!text.trim() || text === lastCheckedText) return;
            lastCheckedText = text;

            try {
              const response = await checkSpelling({
                text,
                language: extensionOptions.language,
              });

              const decorations: Decoration[] = [];

              for (const match of response.matches) {
                let charCount = 0;
                let fromPos = -1;
                let toPos = -1;

                doc.descendants((node, pos) => {
                  if (fromPos !== -1 && toPos !== -1) return false;

                  if (node.isText && node.text) {
                    const nodeStart = charCount;
                    const nodeEnd = charCount + node.text.length;

                    if (match.offset >= nodeStart && match.offset < nodeEnd) {
                      fromPos = pos + (match.offset - nodeStart);
                    }

                    const matchEnd = match.offset + match.length;
                    if (matchEnd > nodeStart && matchEnd <= nodeEnd) {
                      toPos = pos + (matchEnd - nodeStart);
                    }

                    charCount += node.text.length;
                  } else if (node.isBlock && charCount > 0) {
                    charCount += 1;
                  }

                  return true;
                });

                if (fromPos !== -1 && toPos !== -1 && fromPos < toPos) {
                  decorations.push(
                    Decoration.inline(fromPos, toPos, {
                      class: "spell-error",
                      "data-spell-message": match.message,
                      "data-spell-replacements": match.replacements.join(","),
                    }),
                  );
                }
              }

              const decoSet = DecorationSet.create(
                editorView.state.doc,
                decorations,
              );

              const tr = editorView.state.tr.setMeta(spellCheckPluginKey, {
                decorations: decoSet,
                matches: response.matches,
              });
              editorView.dispatch(tr);
            } catch (err) {
              console.warn("[SpellCheck] Error:", err);
            }
          };

          const scheduleCheck = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(runCheck, extensionOptions.debounceMs);
          };

          scheduleCheck();

          return {
            update() {
              scheduleCheck();
            },
            destroy() {
              if (debounceTimer) clearTimeout(debounceTimer);
            },
          };
        },
      }),
    ];
  },
});

import { useCallback, useEffect, useRef } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { Page } from "@/types/bindings/Page";
import { updatePageCanvasState } from "@/lib/ipc";
import { useUIStore } from "@/stores/useUIStore";
import { TitleEditor } from "@/components/editor/TitleEditor";
import { usePageStore } from "@/stores/usePageStore";

const AUTOSAVE_DELAY_MS = 1500;

interface CanvasPageProps {
  page: Page;
}

export function CanvasPage({ page }: CanvasPageProps) {
  const baseTheme = useUIStore((s) => s.theme.baseTheme);
  const { updatePageTitle } = usePageStore();
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);

  const excalidrawTheme = baseTheme === "dark" ? "dark" : "light";

  // Carrega o estado inicial do canvas vindo do backend.
  // collaborators é um Map no Excalidraw, mas vira objeto plano após serialização JSON
  // pelo IPC do Tauri — precisa ser restaurado como new Map() para evitar erro forEach.
  const initialData: ExcalidrawInitialDataState = (() => {
    if (!page.canvas_state) {
      return { elements: [], appState: { viewBackgroundColor: "#ffffff" }, files: {} };
    }
    const stored = page.canvas_state as Record<string, unknown>;
    const storedAppState = stored.appState as Record<string, unknown> | undefined;
    return {
      elements: (stored.elements as ExcalidrawInitialDataState["elements"]) ?? [],
      files: (stored.files as ExcalidrawInitialDataState["files"]) ?? {},
      appState: storedAppState
        ? {
            ...storedAppState,
            collaborators: new Map(),
          }
        : undefined,
    };
  })();

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const api = excalidrawApiRef.current;
      if (!api) return;
      const elements = api.getSceneElements();
      const appState = api.getAppState();
      const files = api.getFiles();
      // Salvar apenas campos escalares do appState — collaborators é um Map e
      // não sobrevive à serialização JSON do IPC Tauri.
      const serializableAppState = {
        viewBackgroundColor: appState.viewBackgroundColor,
        zoom: appState.zoom,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
        theme: appState.theme,
        gridSize: appState.gridSize,
      };
      await updatePageCanvasState(page.id, { elements, appState: serializableAppState, files });
      isDirtyRef.current = false;
    }, AUTOSAVE_DELAY_MS);
  }, [page.id]);

  // Salvar ao desmontar se houver mudanças pendentes
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (isDirtyRef.current) {
        const api = excalidrawApiRef.current;
        if (api) {
          const elements = api.getSceneElements();
          const appState = api.getAppState();
          const files = api.getFiles();
          const serializableAppState = {
            viewBackgroundColor: appState.viewBackgroundColor,
            zoom: appState.zoom,
            scrollX: appState.scrollX,
            scrollY: appState.scrollY,
            theme: appState.theme,
            gridSize: appState.gridSize,
          };
          updatePageCanvasState(page.id, { elements, appState: serializableAppState, files });
        }
      }
    };
  }, [page.id]);

  const handleChange = useCallback(() => {
    isDirtyRef.current = true;
    scheduleSave();
  }, [scheduleSave]);

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      const trimmed = newTitle.trim();
      if (!trimmed || trimmed === page.title) return;
      await updatePageTitle(trimmed);
    },
    [page.title, updatePageTitle],
  );

  return (
    <div
      className="flex flex-1 flex-col overflow-hidden"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div
        className="flex items-center gap-3 border-b px-6 py-3"
        style={{ borderColor: "var(--border)" }}
      >
        <TitleEditor
          title={page.title}
          onTitleChange={handleTitleChange}
          editorRef={{ current: null }}
        />
      </div>

      <div className="relative flex-1">
        <Excalidraw
          excalidrawAPI={(api) => {
            excalidrawApiRef.current = api;
          }}
          initialData={initialData}
          theme={excalidrawTheme}
          onChange={handleChange}
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: false,
              export: { saveFileToDisk: true },
            },
          }}
        />
      </div>
    </div>
  );
}

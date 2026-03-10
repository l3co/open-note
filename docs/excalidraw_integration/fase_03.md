# Fase 03 — Frontend: Componente `CanvasPage`

## Objetivo

Instalar o pacote `@excalidraw/excalidraw`, criar o componente `CanvasPage`
que envolve o Excalidraw com auto-save, integração de tema e persistência via
IPC.

**Pré-requisito:** Fase 02 concluída (`createCanvasPage` e `updatePageCanvasState`
disponíveis em `ipc.ts`).

---

## Contexto

### Referência de padrão existente

O componente `PdfCanvasPage` (`src/components/pdf/PdfCanvasPage.tsx`) é o
template de implementação a seguir:

| Aspecto | `PdfCanvasPage` | `CanvasPage` (novo) |
|---|---|---|
| Modo | `pdf_canvas` | `canvas` |
| Estado principal | `strokesByPage: Map<number, AnchoredStroke[]>` | `excalidrawData: ExcalidrawData` |
| Auto-save | debounce 1500ms + `updatePageAnnotations` | debounce 1500ms + `updatePageCanvasState` |
| Tela cheia | Ocupa `flex-1` do layout | Ocupa `flex-1` do layout |
| Tema | Não tem suporte nativo | `theme="dark"` / `theme="light"` via prop Excalidraw |

### Estrutura de arquivos a criar

```
src/components/canvas/
├── CanvasPage.tsx      # componente principal (lazy-loaded)
└── index.ts            # re-export para uso em PageView
```

---

## Tarefas

### 3.1 — Instalar `@excalidraw/excalidraw`

```bash
npm install @excalidraw/excalidraw
```

Verificar que a versão instalada está compatível com React 18:

```bash
npm ls @excalidraw/excalidraw
```

> A versão `^0.17.x` ou superior é compatível com React 18. Se a versão
> instalada for `0.14.x` ou inferior, usar `npm install @excalidraw/excalidraw@latest`.

---

### 3.2 — Criar `src/components/canvas/CanvasPage.tsx`

Este é o componente principal. Implementar conforme a especificação abaixo:

```tsx
import { useCallback, useEffect, useRef } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types/types";
import type { Page } from "@/types/bindings/Page";
import { updatePageCanvasState } from "@/lib/ipc";
import { useUIStore } from "@/stores/useUIStore";
import { TitleEditor } from "@/components/editor/TitleEditor";
import { usePageStore } from "@/stores/usePageStore";
import { useTranslation } from "react-i18next";

const AUTOSAVE_DELAY_MS = 1500;

interface CanvasPageProps {
  page: Page;
}

export function CanvasPage({ page }: CanvasPageProps) {
  const { t } = useTranslation();
  const baseTheme = useUIStore((s) => s.theme.baseTheme);
  const { updatePageTitle } = usePageStore();
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);

  const excalidrawTheme =
    baseTheme === "dark" ? "dark" : "light";

  // Carrega o estado inicial do canvas vindo do backend
  const initialData: ExcalidrawInitialDataState = page.canvas_state
    ? (page.canvas_state as ExcalidrawInitialDataState)
    : { elements: [], appState: { viewBackgroundColor: "#ffffff" }, files: {} };

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const api = excalidrawApiRef.current;
      if (!api) return;
      const elements = api.getSceneElements();
      const appState = api.getAppState();
      const files = api.getFiles();
      await updatePageCanvasState(page.id, { elements, appState, files });
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
          updatePageCanvasState(page.id, { elements, appState, files });
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
```

> **Observações de implementação:**
>
> - `excalidrawApiRef` usa a API imperativa em vez de state para evitar
>   re-renders desnecessários durante o desenho
> - O save no unmount (`useEffect` cleanup) garante que mudanças não perdidas
>   ao navegar rapidamente entre páginas
> - `UIOptions.canvasActions.saveToActiveFile: false` remove o botão "Save" do
>   Excalidraw (o Open Note cuida do save)
> - `export: { saveFileToDisk: true }` mantém o botão de export para `.excalidraw`
>   (formato aberto, alinhado com o princípio local-first)

---

### 3.3 — Criar `src/components/canvas/index.ts`

```typescript
export { CanvasPage } from "./CanvasPage";
```

---

### 3.4 — Lazy loading em `PageView`

O componente deve ser carregado lazily para não aumentar o bundle inicial.
Este passo é documentado aqui mas será implementado na Fase 04, quando
`PageView` for atualizado.

Referência de uso:
```typescript
// Em PageView.tsx (Fase 04)
const CanvasPage = React.lazy(() =>
  import("@/components/canvas/CanvasPage").then((m) => ({ default: m.CanvasPage }))
);
```

---

### 3.5 — Verificar tipos do `@excalidraw/excalidraw`

O pacote exporta tipos TypeScript. Verificar que os imports de tipo funcionam:

```bash
npx tsc --noEmit
```

Se houver erros de tipo no `ExcalidrawImperativeAPI`, verificar a versão
instalada e ajustar os imports conforme a documentação da versão:

```bash
# Ver exports disponíveis na versão instalada
node -e "console.log(Object.keys(require('@excalidraw/excalidraw')))"
```

---

### 3.6 — Verificar compatibilidade com Tauri WebView

O Excalidraw usa APIs web modernas. Verificar no `tauri.conf.json` se o CSP
(Content Security Policy) não bloqueia o canvas. Se necessário, adicionar:

**Arquivo:** `src-tauri/tauri.conf.json`

Na seção `security.csp`, garantir que `blob:` e `data:` estão permitidos
(necessários para export de imagens do Excalidraw):

```json
"csp": "default-src 'self'; img-src 'self' blob: data:; script-src 'self' 'unsafe-inline'"
```

> Verificar o CSP atual antes de qualquer mudança — alterar apenas se o
> Excalidraw falhar ao renderizar.

---

## Verificação

```bash
# Verificar que o pacote foi instalado
npm ls @excalidraw/excalidraw

# Verificar que TypeScript compila sem erros
npx tsc --noEmit

# Verificar que o build de desenvolvimento funciona
npm run dev
```

Abrir o app, navegar até uma página com `mode: "canvas"` (criada manualmente
no JSON para teste) e verificar que o Excalidraw renderiza.

**Teste manual de persistência:**
1. Abrir uma página canvas
2. Desenhar um retângulo
3. Aguardar 2 segundos (auto-save)
4. Fechar e reabrir a página
5. O retângulo deve estar presente

---

## Critérios de Aceite

- [ ] `npm install @excalidraw/excalidraw` sem conflitos de dependência
- [ ] `CanvasPage.tsx` compila sem erros TypeScript
- [ ] Excalidraw renderiza em modo light e dark conforme tema do app
- [ ] Auto-save dispara após 1500ms de inatividade
- [ ] Estado é salvo via `updatePageCanvasState` IPC
- [ ] Ao navegar para outra página, estado pendente é salvo no unmount
- [ ] Canvas restaura o estado ao recarregar a página
- [ ] Título da página é editável via `TitleEditor`

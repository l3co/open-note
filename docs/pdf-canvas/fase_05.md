# Fase 05 — Frontend: `PdfCanvasPage` Component

## Objetivo

Criar o componente principal da experiência PDF Canvas: uma view full-screen que renderiza o PDF com `pdfjs-dist` e sobrepõe um `InkCanvas` por página para escrita manual.

## Arquivos a criar

- `src/components/pdf/PdfCanvasPage.tsx`
- `src/components/pdf/PdfCanvasToolbar.tsx`

---

## Arquitetura do componente

```
PdfCanvasPage
├── PdfCanvasToolbar           ← nav, zoom, toggle scroll/draw, ferramentas ink
└── <div> scroll container
    └── {pagesToRender.map(pageNum =>
          <div className="relative">
            <canvas />          ← pdfjs renderiza o PDF aqui
            {inkMode && (
              <InkCanvas />     ← overlay de escrita (position: absolute)
            )}
          </div>
        )}
```

---

## Sistema de coordenadas

**Problema:** O InkCanvas captura coordenadas CSS (pixels na tela). O PDF é renderizado em
tamanho variável dependendo do `scale`. Se o usuário fizer zoom, os strokes devem continuar
no lugar certo.

**Solução:** Armazenar strokes em **coordenadas PDF** (pontos, independente de escala):

```ts
// Ao salvar um stroke (capturado em CSS pixels):
const toPdfCoords = (stroke: Stroke, scale: number): Stroke => ({
  ...stroke,
  points: stroke.points.map(p => ({
    x: p.x / scale,
    y: p.y / scale,
    pressure: p.pressure,
  })),
});

// Ao renderizar (passado para InkCanvas):
const toCanvasCoords = (stroke: Stroke, scale: number): Stroke => ({
  ...stroke,
  points: stroke.points.map(p => ({
    x: p.x * scale,
    y: p.y * scale,
    pressure: p.pressure,
  })),
});
```

---

## Estado local de `PdfCanvasPage`

```ts
// PDF
const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [pageCount, setPageCount] = useState(page.pdf_total_pages);
const [currentPage, setCurrentPage] = useState(1);
const [scale, setScale] = useState(1.5);
const [displayMode, setDisplayMode] = useState<"single" | "continuous">("continuous");

// Dimensões por página (CSS pixels)
const [pageDimensions, setPageDimensions] = useState<Map<number, { w: number; h: number }>>(new Map());

// Ink
const [inkMode, setInkMode] = useState(false);
const [tool, setTool] = useState<InkTool>("pen");
const [color, setColor] = useState("#1a1a1a");
const [size, setSize] = useState(4);

// Strokes: Map<pageNum, Stroke[]> — em coordenadas PDF
const [strokesByPage, setStrokesByPage] = useState<Map<number, Stroke[]>>(new Map());
const [undoStack, setUndoStack] = useState<Array<{ page: number; strokes: Stroke[] }>>([]);
const [redoStack, setRedoStack] = useState<Array<{ page: number; Strokes: Stroke[] }>>([]);

// Refs de canvas PDF por página
const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
```

---

## Carregamento do PDF

```ts
useEffect(() => {
  if (!page.pdf_asset) return;

  const load = async () => {
    setLoading(true);
    try {
      const base64 = await readAssetBase64(absoluteAssetPath(page.pdf_asset!));
      const response = await fetch(base64);
      const buffer = await response.arrayBuffer();

      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();

      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
      setPdfDoc(doc);
      setPageCount(doc.numPages);
    } catch (err) {
      setError("Erro ao carregar PDF");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  load();
}, [page.id, page.pdf_asset]);
```

**Nota sobre `absoluteAssetPath`:** A função resolve o caminho relativo (`assets/abc.pdf`)
para o caminho absoluto no filesystem. Reutilizar a lógica já existente no projeto (checar
como `PdfViewer` atual resolve o `src` base64 via `readAssetBase64`).

---

## Carregamento das anotações existentes

```ts
useEffect(() => {
  const map = new Map<number, Stroke[]>();
  for (const stroke of page.annotations.strokes) {
    const pageNum = stroke.anchor?.pdf_page ?? 1;
    const existing = map.get(pageNum) ?? [];
    // Converter AnchoredStroke → Stroke (campos compatíveis)
    map.set(pageNum, [...existing, anchoredToStroke(stroke)]);
  }
  setStrokesByPage(map);
}, [page.id]);
```

Função auxiliar:
```ts
function anchoredToStroke(s: AnchoredStroke): Stroke {
  return {
    id: s.id,
    points: s.points,
    color: s.color,
    size: s.size,
    tool: s.tool as InkTool,
    opacity: s.opacity,
    timestamp: s.timestamp,
  };
}
```

---

## Renderização do PDF

```ts
useEffect(() => {
  if (!pdfDoc) return;
  const pages = displayMode === "single" ? [currentPage] : Array.from({ length: pageCount }, (_, i) => i + 1);

  const renderAll = async () => {
    for (const num of pages) {
      const canvas = canvasRefs.current.get(num);
      if (!canvas) continue;

      const pdfPage = await pdfDoc.getPage(num);
      const viewport = pdfPage.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;

      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      await pdfPage.render({ canvasContext: ctx, viewport }).promise;

      // Atualiza dimensões para o InkCanvas
      setPageDimensions(prev => new Map(prev).set(num, {
        w: viewport.width,
        h: viewport.height,
      }));
    }
  };

  renderAll();
}, [pdfDoc, displayMode, currentPage, pageCount, scale]);
```

---

## Tratamento de strokes

### Ao completar um stroke

```ts
const handleStrokeComplete = useCallback(
  (pageNum: number, stroke: Stroke) => {
    // Snapshot para undo
    setUndoStack(prev => [...prev, { page: pageNum, strokes: strokesByPage.get(pageNum) ?? [] }]);
    setRedoStack([]);

    // Salvar em coordenadas PDF
    const pdfStroke = toPdfCoords(stroke, scale);
    const next = new Map(strokesByPage);
    next.set(pageNum, [...(next.get(pageNum) ?? []), pdfStroke]);
    setStrokesByPage(next);

    // Auto-save com debounce
    debouncedSave(next);
  },
  [strokesByPage, scale, debouncedSave],
);
```

### Ao apagar um stroke

```ts
const handleStrokeErased = useCallback(
  (pageNum: number, strokeId: string) => {
    setUndoStack(prev => [...prev, { page: pageNum, strokes: strokesByPage.get(pageNum) ?? [] }]);
    setRedoStack([]);
    const next = new Map(strokesByPage);
    next.set(pageNum, (next.get(pageNum) ?? []).filter(s => s.id !== strokeId));
    setStrokesByPage(next);
    debouncedSave(next);
  },
  [strokesByPage, debouncedSave],
);
```

### Undo / Redo

```ts
const handleUndo = useCallback(() => {
  if (undoStack.length === 0) return;
  const last = undoStack[undoStack.length - 1]!;
  setRedoStack(prev => [...prev, { page: last.page, strokes: strokesByPage.get(last.page) ?? [] }]);
  const next = new Map(strokesByPage);
  next.set(last.page, last.strokes);
  setStrokesByPage(next);
  setUndoStack(prev => prev.slice(0, -1));
  debouncedSave(next);
}, [undoStack, strokesByPage, debouncedSave]);
```

---

## Auto-save com debounce

```ts
const debouncedSave = useDebouncedCallback(
  async (strokes: Map<number, Stroke[]>) => {
    const flatStrokes = flattenToAnchoredStrokes(strokes);
    await updatePageAnnotations(
      page.id,
      { strokes: flatStrokes, highlights: page.annotations.highlights, svg_cache: null },
      workspaceId,
    );
  },
  1500,
);
```

**`flattenToAnchoredStrokes`:** converte `Map<pageNum, Stroke[]>` → `AnchoredStroke[]`:
```ts
function flattenToAnchoredStrokes(map: Map<number, Stroke[]>): AnchoredStroke[] {
  const result: AnchoredStroke[] = [];
  for (const [pageNum, strokes] of map) {
    for (const stroke of strokes) {
      result.push({
        ...stroke,
        anchor: {
          block_id: "00000000-0000-0000-0000-000000000000",
          offset_x: 0,
          offset_y: 0,
          pdf_page: pageNum,
        },
      });
    }
  }
  return result;
}
```

> **Debounce:** usar `useDebouncedCallback` do `use-debounce` (já deve estar no projeto).
> Se não estiver, implementar com `useRef` + `setTimeout`.

---

## JSX do componente

```tsx
export function PdfCanvasPage({ page }: { page: Page }) {
  // ... estado e handlers acima ...

  const pagesToRender = displayMode === "single"
    ? [currentPage]
    : Array.from({ length: pageCount }, (_, i) => i + 1);

  return (
    <div className="flex flex-1 flex-col overflow-hidden" style={{ backgroundColor: "var(--bg-primary)" }}>
      <PdfCanvasToolbar
        currentPage={currentPage}
        pageCount={pageCount}
        scale={scale}
        inkMode={inkMode}
        tool={tool}
        color={color}
        size={size}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onPrev={() => setCurrentPage(p => Math.max(1, p - 1))}
        onNext={() => setCurrentPage(p => Math.min(pageCount, p + 1))}
        onZoomIn={() => setScale(s => Math.min(s + 0.25, 4.0))}
        onZoomOut={() => setScale(s => Math.max(s - 0.25, 0.5))}
        onToggleInkMode={() => setInkMode(m => !m)}
        onToolChange={setTool}
        onColorChange={setColor}
        onSizeChange={setSize}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      <div className="flex-1 overflow-auto" style={{ backgroundColor: "var(--bg-secondary)" }}>
        {loading && (
          <div className="flex items-center justify-center py-20 text-sm" style={{ color: "var(--text-tertiary)" }}>
            {t("pdf_canvas.loading")}
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center py-20 text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </div>
        )}

        <div className="flex flex-col items-center gap-4 py-6">
          {pagesToRender.map(pageNum => {
            const dims = pageDimensions.get(pageNum);
            const pageStrokes = strokesByPage.get(pageNum) ?? [];
            const canvasStrokes = dims
              ? pageStrokes.map(s => toCanvasCoords(s, scale))
              : [];

            return (
              <div
                key={pageNum}
                className="relative"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}
              >
                <canvas
                  ref={el => {
                    if (el) canvasRefs.current.set(pageNum, el);
                    else canvasRefs.current.delete(pageNum);
                  }}
                />
                {inkMode && dims && (
                  <InkCanvas
                    width={dims.w}
                    height={dims.h}
                    strokes={canvasStrokes}
                    activeTool={tool}
                    activeColor={color}
                    activeSize={size}
                    onStrokeComplete={stroke => handleStrokeComplete(pageNum, stroke)}
                    onStrokeErased={id => handleStrokeErased(pageNum, id)}
                    className="absolute inset-0"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

---

## `PdfCanvasToolbar` — estrutura

```tsx
interface PdfCanvasToolbarProps {
  currentPage: number; pageCount: number; scale: number;
  inkMode: boolean; tool: InkTool; color: string; size: number;
  canUndo: boolean; canRedo: boolean;
  onPrev: () => void; onNext: () => void;
  onZoomIn: () => void; onZoomOut: () => void;
  onToggleInkMode: () => void;
  onToolChange: (t: InkTool) => void;
  onColorChange: (c: string) => void;
  onSizeChange: (s: number) => void;
  onUndo: () => void; onRedo: () => void;
}

export function PdfCanvasToolbar(props: PdfCanvasToolbarProps) {
  return (
    <div className="flex items-center gap-2 border-b px-3 py-1.5 flex-wrap"
         style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}>

      {/* Navegação de páginas */}
      <div className="flex items-center gap-1">
        <NavBtn onClick={onPrev} disabled={currentPage <= 1}><ChevronLeft size={16}/></NavBtn>
        <span className="text-xs min-w-[60px] text-center">{currentPage} / {pageCount}</span>
        <NavBtn onClick={onNext} disabled={currentPage >= pageCount}><ChevronRight size={16}/></NavBtn>
      </div>

      <Separator />

      {/* Zoom */}
      <div className="flex items-center gap-1">
        <NavBtn onClick={onZoomOut}><ZoomOut size={14}/></NavBtn>
        <span className="text-xs min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
        <NavBtn onClick={onZoomIn}><ZoomIn size={14}/></NavBtn>
      </div>

      <Separator />

      {/* Toggle scroll/escrita */}
      <NavBtn onClick={onToggleInkMode} active={inkMode} title={inkMode ? t("pdf_canvas.toolbar.draw_mode") : t("pdf_canvas.toolbar.scroll_mode")}>
        {inkMode ? <Pencil size={14}/> : <Hand size={14}/>}
      </NavBtn>

      {/* Ferramentas ink (só visível no modo escrita) */}
      {inkMode && (
        <>
          <Separator />
          <NavBtn onClick={() => onToolChange("pen")} active={tool === "pen"}><Pen size={14}/></NavBtn>
          <NavBtn onClick={() => onToolChange("marker")} active={tool === "marker"}><Highlighter size={14}/></NavBtn>
          <NavBtn onClick={() => onToolChange("eraser")} active={tool === "eraser"}><Eraser size={14}/></NavBtn>

          {/* Seletor de cor — simples, 5 cores fixas */}
          <div className="flex gap-1">
            {["#1a1a1a", "#ef4444", "#3b82f6", "#16a34a", "#f59e0b"].map(c => (
              <button key={c}
                className="h-5 w-5 rounded-full border-2 transition-transform"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? "var(--accent)" : "transparent",
                  transform: color === c ? "scale(1.2)" : "scale(1)",
                }}
                onClick={() => onColorChange(c)}
              />
            ))}
          </div>

          <Separator />
          <NavBtn onClick={onUndo} disabled={!canUndo}><Undo2 size={14}/></NavBtn>
          <NavBtn onClick={onRedo} disabled={!canRedo}><Redo2 size={14}/></NavBtn>
        </>
      )}
    </div>
  );
}
```

---

## Critério de conclusão

- [ ] `PdfCanvasPage` renderiza o PDF corretamente
- [ ] InkCanvas ativa/desativa pelo toggle de modo
- [ ] Strokes aparecem sobre o PDF na posição correta
- [ ] Após zoom, strokes continuam no lugar correto (coordenadas PDF)
- [ ] Undo/redo funcionam por página
- [ ] Auto-save dispara 1500ms após último stroke
- [ ] Páginas existentes sem anotações carregam sem erro
- [ ] PDF sem `pdf_asset` mostra estado de erro amigável

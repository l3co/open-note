# PDF Canvas Page — Visão Geral

## Conceito

Novo tipo de página onde o **PDF é a própria página**, não um bloco dentro de uma página. O usuário pode escrever à mão sobre o conteúdo do PDF, como no GoodNotes ou Notability.

Isso é diferente do bloco PDF atual (`pdfBlock` no TipTap), que é um elemento embutido num documento rich text.

---

## Comparação com o modo atual

| | Bloco PDF (atual) | PDF Canvas Page (novo) |
|---|---|---|
| Onde vive | Dentro de uma página rich text | É a própria página |
| Escrita | Texto ao redor do bloco | Handwriting direto sobre o PDF |
| Ferramentas | Zoom, scroll, página | Zoom, scroll, pen, marker, eraser, undo/redo |
| Ativação | Slash command no editor | "Importar PDF" no menu de seção |
| Armazenamento | Bloco TipTap com `src` base64 | Arquivo PDF em `assets/` + strokes no `.opn.json` |

---

## Fluxo do usuário

```
1. Clique direito na seção
         │
         ▼
2. "Importar PDF" no context menu
         │
         ▼
3. File picker (filtro: .pdf)
         │
         ▼
4. PDF copiado para section/assets/{uuid}.pdf
   Página criada: mode=pdf_canvas, pdf_asset="assets/{uuid}.pdf"
         │
         ▼
5. Página abre no PdfCanvasPage (full-screen)
         │
         ├─ Modo Scroll (padrão): navegar, zoom
         │
         └─ Modo Escrita: overlay InkCanvas ativado
                   │
                   ▼
              Strokes capturados por página
                   │
                   ▼
              Auto-save (debounce 1500ms)
              → update_page_annotations via IPC
```

---

## Layout do PdfCanvasPage

```
┌──────────────────────────────────────────────────────┐
│ [← Prev] [→ Next]  3/12  │ [-] 75% [+] │ [📜] [🖊] │
│ (quando modo escrita) [pen] [marker] [eraser] ■ ■ ■  │
│ [↩ undo] [↪ redo]                                    │
├──────────────────────────────────────────────────────┤
│                                                      │
│   ┌─────────────────────────────────────┐           │
│   │  <canvas> ← pdfjs renderiza página │           │
│   │  <canvas> ← InkCanvas overlay      │  (abs.)   │
│   └─────────────────────────────────────┘           │
│                                                      │
│   ┌─────────────────────────────────────┐           │
│   │  <canvas> ← página 2               │           │
│   │  <canvas> ← InkCanvas overlay      │           │
│   └─────────────────────────────────────┘           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Modo Scroll:** `pointer-events: none` no InkCanvas → scroll e zoom funcionam normalmente.  
**Modo Escrita:** `pointer-events: auto` no InkCanvas → strokes capturados.

---

## Sistema de coordenadas (decisão técnica)

Strokes são armazenados em **coordenadas PDF (pontos)**, independente do zoom:

```
// Captura (CSS pixels → PDF points)
pdfX = offsetX / scale
pdfY = offsetY / scale

// Renderização (PDF points → CSS pixels)
cssX = pdfX * scale
cssY = pdfY * scale
```

Isso garante que anotações aparecem no lugar correto em qualquer nível de zoom.

---

## Armazenamento de anotações

As anotações são `AnchoredStroke[]` no campo `annotations.strokes` da `Page`, com `anchor.pdf_page` indicando a página do PDF:

```json
{
  "annotations": {
    "strokes": [
      {
        "id": "...",
        "points": [{ "x": 120.5, "y": 88.3, "pressure": 0.6 }],
        "color": "#1a1a1a",
        "size": 4.0,
        "tool": "pen",
        "opacity": 1.0,
        "timestamp": 1741540000000,
        "anchor": {
          "block_id": "00000000-0000-0000-0000-000000000000",
          "offset_x": 0.0,
          "offset_y": 0.0,
          "pdf_page": 3
        }
      }
    ],
    "highlights": [],
    "svg_cache": null
  }
}
```

> `block_id` é um UUID nulo para strokes de PDF Canvas (sem bloco associado). `pdf_page` (1-indexed) identifica a página.

---

## Estrutura de arquivos a criar/modificar

```
docs/pdf-canvas/
  overview.md          ← este arquivo
  fase_01.md           ← Domínio (crates/core)
  fase_02.md           ← Storage (crates/storage)
  fase_03.md           ← IPC commands (src-tauri)
  fase_04.md           ← Frontend IPC + types
  fase_05.md           ← PdfCanvasPage component
  fase_06.md           ← Roteamento + ContextMenu
  fase_07.md           ← Testes

crates/core/src/
  page.rs              ← EditorMode::PdfCanvas, campos pdf_*

crates/storage/src/
  engine.rs            ← create_page_from()
  migrations.rs        ← guard defensivo

src-tauri/src/
  commands/page.rs     ← create_pdf_canvas_page, update_page_annotations
  lib.rs               ← registrar comandos

src/
  lib/ipc.ts           ← createPdfCanvasPage, updatePageAnnotations
  components/
    pages/PageView.tsx            ← roteamento por mode
    shared/ContextMenu.tsx        ← item "Importar PDF"
    pdf/PdfCanvasPage.tsx         ← NOVO: view principal
    pdf/PdfCanvasToolbar.tsx      ← NOVO: toolbar
  locales/
    pt-BR.json                    ← novas chaves i18n
    en.json                       ← novas chaves i18n
```

---

## Estimativa de esforço

| Fase | Descrição | Esforço |
|---|---|---|
| 1 | Domínio | ~1h |
| 2 | Storage | ~30min |
| 3 | IPC | ~1h |
| 4 | Frontend types | ~30min |
| 5 | PdfCanvasPage | ~3h |
| 6 | Roteamento + Menu | ~1h |
| 7 | Testes | ~2h |
| **Total** | | **~9h** |

---

## Dependências existentes reutilizadas

- `pdfjs-dist` — já configurado em `PdfViewer.tsx`
- `perfect-freehand` via `InkCanvas` — já implementado
- `engine.ts` (`renderStrokeToCanvas`, `simplifyPoints`, `hitTestStroke`) — já implementado
- `import_pdf` + `count_pdf_pages` — já implementado em `commands/page.rs`
- `read_asset_base64` — já implementado
- `@tauri-apps/plugin-dialog` (`open`) — já usado no SlashCommandMenu

**Nenhuma nova dependência necessária.**

# Fase 07 — Handwriting, Ink & Anotação

## Objetivo

Implementar um sistema **híbrido de ink** com duas capacidades complementares:

1. **Ink Overlay** — Camada de anotação transparente sobre todo o conteúdo da page (texto, imagens, PDFs). Permite escrever, marcar, circular e sublinhar **em cima** do conteúdo existente, como no Microsoft OneNote.
2. **Ink Block** — Bloco dedicado para desenho livre (diagramas, sketches, rascunhos). Inserido como bloco dentro da hierarquia do editor.

Além disso, implementar **importação e anotação de PDFs** como conteúdo de page.

---

## Dependências

- Fase 04 concluída (editor TipTap — base de conteúdo sobre a qual o overlay opera)
- Fase 05 parcialmente concluída (ImageBlock — mecanismo de assets reutilizado para PDFs)

---

## Entregáveis

### Ink Engine (compartilhado)
1. Motor de rendering de strokes com traço suave (perfect-freehand)
2. Ferramentas de desenho: caneta, marcador, borracha, lasso select
3. Paleta de cores e espessuras
4. Suporte a pressure sensitivity (stylus/tablet)
5. Undo/Redo de strokes
6. Export de strokes para SVG
7. Point simplification (Ramer-Douglas-Peucker)

### Ink Overlay (anotação)
8. Canvas transparente sobre toda a área de conteúdo da page
9. Modo "Anotar" ativável via toolbar (toggle entre editar texto e anotar)
10. Strokes ancorados à posição do conteúdo (acompanham scroll)
11. Anotação sobre texto, imagens, PDFs e qualquer conteúdo renderizado
12. Highlighter inteligente (marca-texto que se ancora a linhas de texto)

### Ink Block (desenho dedicado)
13. InkBlock inserível via slash command `/draw`
14. Canvas isolado com dimensões configuráveis
15. Redimensionamento e modo tela cheia

### PDF
16. Importação de PDF como bloco (PdfBlock)
17. Renderização de PDF dentro da page (pdf.js)
18. Anotação sobre PDF via Ink Overlay
19. Navegação entre páginas do PDF

---

## Arquitetura — Modelo Híbrido

### Visão Geral

```
┌────────────────────────────────────────────────────────────┐
│                    Page (content area)                      │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          Ink Overlay Layer                            │  │
│  │  (canvas transparente, position: absolute,           │  │
│  │   cobre toda a page, pointer-events condicionais)    │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │          Content Layer (HTML/DOM)                     │  │
│  │                                                      │  │
│  │  [TextBlock]  Título da aula                        │  │
│  │  [TextBlock]  Parágrafo com conteúdo                │  │
│  │  [ImageBlock] Diagrama importado                    │  │
│  │  [PdfBlock]   Documento PDF renderizado             │  │
│  │  [InkBlock]   Canvas dedicado para desenho          │  │
│  │  [TextBlock]  Mais conteúdo...                      │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Dois Modos de Interação

| Modo | Ativação | Comportamento |
|---|---|---|
| **Editar** (padrão) | Padrão ao abrir page | Mouse/teclado interage com o conteúdo (TipTap). Overlay invisível a pointer events. |
| **Anotar** | Botão na toolbar ou atalho `Cmd/Ctrl + Shift + A` | Mouse/stylus interage com o Overlay. Conteúdo abaixo fica read-only. Strokes são desenhados sobre o conteúdo. |

**Transição automática com stylus:**
- Se o sistema detectar input de `pen` (stylus) via PointerEvent, ativar modo Anotar automaticamente
- Input de `mouse` → modo Editar (padrão)
- Input de `touch` → configurável (Anotar ou scroll)

---

## Ink Overlay — Detalhamento

### Como funciona

O Overlay é um **canvas (ou SVG) transparente** posicionado com `position: absolute` sobre toda a área de conteúdo da page.

```css
.ink-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;        /* altura total do conteúdo, não apenas viewport */
  pointer-events: none; /* modo Editar: não intercepta eventos */
  z-index: 100;
}

.ink-overlay.annotating {
  pointer-events: auto; /* modo Anotar: captura eventos */
  cursor: crosshair;
}
```

### Ancoragem ao Conteúdo

**Problema:** Se o conteúdo muda (novo bloco inserido, texto expandido), os strokes do overlay precisam continuar ancorados ao conteúdo correto.

**Estratégia: Coordenadas relativas ao documento**

Os strokes usam coordenadas relativas ao **topo do conteúdo da page** (não ao viewport):

```typescript
interface OverlayStroke extends Stroke {
  // Coordenadas relativas ao topo do document content
  // Não mudam com scroll
  // Scroll é tratado no rendering (translate do canvas)
}
```

**Ao scrollar:** O canvas se move junto com o conteúdo. Implementado via CSS `transform: translateY(-scrollTop)` ou re-posicionamento do canvas.

**Quando conteúdo muda (inserção de bloco acima):**

Isso é o cenário mais complexo. Opções:

1. **Offset adjustment** — Detectar que conteúdo acima foi inserido/removido → ajustar Y de todos os strokes abaixo. Frágil.
2. **Anchor elements** — Cada stroke é ancorado ao bloco DOM mais próximo via `data-block-id`. Quando o bloco se move (re-layout), o stroke acompanha. Mais robusto.
3. **Snapshot approach** — Cada "sessão de anotação" gera um snapshot do layout. Strokes são relativos a esse snapshot. Se o layout mudar muito, avisar o usuário.

**Decisão:** **Anchor elements (opção 2)** para anotações sobre texto/blocos, com fallback para coordenadas absolutas para anotações em áreas sem bloco associado.

```typescript
interface AnchoredStroke extends Stroke {
  anchor: {
    blockId: string;        // ID do bloco de referência
    offsetX: number;        // offset relativo ao bloco
    offsetY: number;        // offset relativo ao topo do bloco
  } | null;                 // null = coordenada absoluta (sem âncora)
}
```

**Ao renderizar:**
1. Para cada stroke com âncora, buscar posição atual do bloco no DOM
2. Calcular posição final: `blockElement.offsetTop + stroke.anchor.offsetY`
3. Renderizar stroke na posição calculada

**Ao adicionar stroke:**
1. Detectar qual bloco DOM está sob o ponto de início do stroke
2. Calcular offset relativo ao bloco
3. Salvar âncora

---

### Overlay vs SVG

| Opção | Prós | Contras |
|---|---|---|
| **Canvas** | Performance (60fps), bitmap cache | Re-render manual, sem DOM nativo |
| **SVG** | Cada stroke é elemento DOM, selecionável, escalável | Performance ruim com muitos strokes (>500) |

**Decisão:** **Canvas para drawing ativo** (performance) + **SVG para exibição idle** (interatividade, zoom, print).

Fluxo:
1. Modo Anotar ativo → Canvas 2D captura input e renderiza em tempo real
2. Ao sair do modo Anotar → Converter strokes para SVG → Exibir SVG overlay
3. SVG é mais leve para exibição estática e permite zoom sem perda

---

### Highlighter Inteligente

Ferramenta especial que **ancora a marcação a linhas de texto**.

**Comportamento:**
- Usuário seleciona ferramenta "Marca-texto"
- Ao arrastar sobre texto, o highlight se **ajusta às linhas** (snap to text)
- Resultado: retângulos semi-transparentes sobre as linhas de texto (como marca-texto real)
- Diferente do highlighter livre (que é um traço como qualquer outro)

**Implementação:**
1. Ao mover o cursor no modo highlighter, usar `document.caretRangeFromPoint(x, y)` para detectar a posição no texto
2. Expandir a range para a linha inteira (ou seleção do usuário)
3. Usar `range.getClientRects()` para obter os retângulos exatos das linhas
4. Renderizar retângulos semi-transparentes sobre essas áreas
5. Salvar como highlight annotation (não como stroke livre)

```typescript
interface HighlightAnnotation {
  id: string;
  blockId: string;               // bloco de texto de referência
  startOffset: number;           // offset no texto
  endOffset: number;
  color: string;
  opacity: number;               // default: 0.3
}
```

---

## Ink Block — Detalhamento

### Conceito

InkBlock é um **bloco dentro da hierarquia do TipTap**, contendo um canvas dedicado para desenho livre. Diferente do Overlay, o InkBlock:

- Tem dimensões próprias (width x height)
- Não depende de conteúdo externo
- Ideal para diagramas, sketches, rascunhos
- Pode ser reordenado como qualquer bloco

```
[TextBlock]  Título da aula
[TextBlock]  Parágrafo explicativo
[InkBlock]   ← diagrama desenhado à mão (canvas 800x400)
[TextBlock]  Continuação do texto
```

### InkBlock no `.opn.json`

```json
{
  "id": "block-uuid",
  "type": "ink",
  "content": {
    "width": 800,
    "height": 400,
    "background": "transparent",
    "strokes": [
      {
        "id": "stroke-uuid",
        "points": [
          { "x": 10.5, "y": 20.3, "pressure": 0.7 },
          { "x": 11.2, "y": 21.0, "pressure": 0.6 },
          { "x": 12.0, "y": 22.1, "pressure": 0.5 }
        ],
        "color": "#1a1a1a",
        "size": 3,
        "tool": "pen",
        "opacity": 1.0,
        "timestamp": 1709820000000
      }
    ],
    "svg_cache": "assets/ink-abc123.svg"
  },
  "order": 2
}
```

### Funcionalidades do InkBlock

- Inserível via slash command `/draw`
- Redimensionável via handle na borda inferior (drag to resize)
- Largura: 100% da área de conteúdo
- Altura mínima: 100px, padrão: 300px
- Modo tela cheia (botão `⛶` ou `F11`)
- Toolbar de desenho própria (aparece ao focar)

### Estados do InkBlock

1. **Idle** — Exibe SVG cache (rápido, sem canvas inicializado)
2. **Editing** — Click/touch → inicializa canvas, exibe toolbar de desenho
3. **Fullscreen** — Canvas ocupa toda a content area

---

## PDF Block — Detalhamento

### Conceito

PdfBlock é um **bloco que renderiza um documento PDF** dentro da page. O PDF é tratado como conteúdo importado sobre o qual o Ink Overlay pode anotar.

```
[TextBlock]  Revisão do artigo
[PdfBlock]   ← PDF renderizado (com anotações ink por cima via Overlay)
[TextBlock]  Minhas conclusões
```

### Importação de PDF

**Meios de inserção:**
1. Slash command `/pdf` → abre file picker nativo
2. Drag & drop de arquivo `.pdf` na área do editor
3. Menu: "Inserir → Documento PDF"

**Fluxo de armazenamento:**
```
1. Usuário seleciona PDF
2. Frontend envia path via IPC para Rust
3. Rust copia PDF para {section}/assets/{uuid}.pdf
4. Retorna referência do asset
5. Frontend renderiza via pdf.js
```

### Renderização com pdf.js

**Biblioteca:** `pdfjs-dist` — renderizador PDF em JavaScript, mantido pela Mozilla.

```typescript
import * as pdfjsLib from 'pdfjs-dist';
import { TextLayerBuilder } from 'pdfjs-dist/web/pdf_viewer';

async function renderPdfPage(
  pdfPath: string,
  pageNumber: number,
  container: HTMLElement,
  scale: number = 1.5
): Promise<void> {
  const pdf = await pdfjsLib.getDocument(pdfPath).promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  // 1. Canvas layer (renderização visual do PDF)
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  container.appendChild(canvas);

  // 2. Text layer (seleção e cópia de texto)
  const textContent = await page.getTextContent();
  const textLayerDiv = document.createElement('div');
  textLayerDiv.className = 'pdf-text-layer';
  container.appendChild(textLayerDiv);

  const textLayer = new TextLayerBuilder({ pdfPage: page });
  textLayer.render({ textContentSource: textContent, container: textLayerDiv, viewport });

  // 3. Ink overlay canvas fica POR CIMA de ambos (z-index mais alto)
}
```

### Text Layer (seleção de texto no PDF)

O pdf.js suporta uma camada de texto invisível posicionada sobre o canvas. Isso permite:

- **Selecionar e copiar** texto do PDF (Ctrl+C)
- **Smart Highlighter** funcionar sobre texto de PDF (ancoragem por offset de texto)
- **Busca** (Fase 08) indexar texto extraído do PDF

**Estrutura de camadas (z-index):**

```
┌─────────────────────────────┐
│  4. Ink Overlay Canvas       │  ← anotações ink (z-index: 30)
│  3. Text Layer (transparent) │  ← seleção de texto (z-index: 20)
│  2. Canvas (PDF visual)      │  ← renderização visual (z-index: 10)
│  1. Container div            │  ← posicionamento
└─────────────────────────────┘
```

**CSS necessário:**

```css
.pdf-text-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  opacity: 0.25;         /* invisível, mas selecionável */
  line-height: 1;
  z-index: 20;
}

.pdf-text-layer span {
  position: absolute;
  white-space: pre;
  color: transparent;
  pointer-events: all;   /* permite seleção */
}

.pdf-text-layer ::selection {
  background: rgba(0, 100, 200, 0.3);  /* destaque azul ao selecionar */
}
```

**Regra:** O text layer está **sempre** ativo. Quando o modo de anotação ink está ativo, o ink overlay canvas captura os pointer events (pointer-events: all no canvas, none no text layer). Quando ink está desativado, o text layer recebe os eventos para seleção.

### Navegação entre Páginas do PDF

```
┌─────────────────────────────────────────┐
│  📄 documento.pdf                       │
├─────────────────────────────────────────┤
│                                         │
│      [Página do PDF renderizada]        │
│                                         │
├─────────────────────────────────────────┤
│  [◀ Anterior]  Página 3 de 15  [Próxima ▶]  │
│                                         │
│  Exibição: [Uma página] [Contínuo]      │
└─────────────────────────────────────────┘
```

**Modos de exibição:**
1. **Uma página** — Exibe uma página por vez com navegação
2. **Contínuo** — Exibe todas as páginas em sequência (scroll contínuo) — mais natural para anotação

**Decisão:** Modo contínuo como padrão (mais natural para anotar com ink).

### Anotação sobre PDF

O Ink Overlay opera **sobre** o PDF renderizado. Strokes são ancorados por:

```typescript
interface PdfAnchoredStroke extends Stroke {
  anchor: {
    blockId: string;        // ID do PdfBlock
    pdfPage: number;        // número da página do PDF (1-indexed)
    offsetX: number;        // offset relativo ao canto superior esquerdo da página
    offsetY: number;
  };
}
```

Isso garante que anotações feitas na página 5 do PDF permanecem na página 5, independente de scroll ou re-render.

### PdfBlock no `.opn.json`

```json
{
  "id": "block-uuid",
  "type": "pdf",
  "content": {
    "src": "assets/documento-abc123.pdf",
    "total_pages": 15,
    "display_mode": "continuous",
    "current_page": 3,
    "scale": 1.5
  },
  "order": 3
}
```

### Comandos IPC para PDF

| Comando | Input | Output |
|---|---|---|
| `import_pdf` | `section_id, file_path` | `{ asset_path, total_pages }` |
| `get_pdf_info` | `asset_path` | `{ total_pages, title, author, size_bytes }` |

---

## Modelo de Dados — Ink Layer da Page

As anotações do Overlay são armazenadas **na Page**, separadas dos blocos:

```json
{
  "id": "page-uuid",
  "title": "Aula 01",
  "schema_version": 1,
  "blocks": [ ... ],
  "annotations": {
    "strokes": [
      {
        "id": "stroke-uuid",
        "points": [ ... ],
        "color": "#ef4444",
        "size": 3,
        "tool": "pen",
        "opacity": 1.0,
        "timestamp": 1709820000000,
        "anchor": {
          "blockId": "block-uuid-2",
          "offsetX": 150.5,
          "offsetY": 30.2
        }
      }
    ],
    "highlights": [
      {
        "id": "highlight-uuid",
        "blockId": "block-uuid-1",
        "startOffset": 45,
        "endOffset": 120,
        "color": "#eab308",
        "opacity": 0.3
      }
    ],
    "svg_cache": "assets/annotations-page-uuid.svg"
  }
}
```

**Separação `blocks` vs `annotations`:**
- `blocks` = conteúdo estrutural (texto, imagens, PDFs, ink blocks)
- `annotations` = camada de anotação (strokes do overlay, highlights)
- São independentes — deletar um bloco **não** deleta automaticamente suas anotações

### Annotations Órfãs (bloco deletado)

Quando um bloco é removido da page, as annotations ancoradas a ele tornam-se **órfãs** (`anchor.blockId` aponta para bloco inexistente).

**Comportamento definido:**

1. **Ao deletar bloco com annotations:** Exibir dialog de confirmação:
   - "Este bloco possui X anotações. O que deseja fazer?"
   - Opções:
     - **Manter anotações** — annotations são convertidas para coordenada absoluta (anchor = null, posição calculada no momento da deleção). Ficam visíveis no local original.
     - **Deletar anotações** — annotations são removidas junto com o bloco.
     - **Cancelar** — não deleta o bloco.

2. **Conversão para coordenada absoluta:**
   ```typescript
   // Ao manter annotations de bloco deletado:
   orphanedStroke.anchor = null;
   // As coordenadas x/y passam a ser absolutas (relativas ao topo da page)
   // Calculadas no momento: blockElement.offsetTop + stroke.anchor.offsetY
   ```

3. **Detecção de órfãs ao abrir page:**
   - Ao carregar uma page, verificar se todos os `anchor.blockId` existem em `blocks`
   - Se houver annotations com blockId inválido (ex: edição manual do JSON, bug), converter automaticamente para coordenada absoluta e logar warning

4. **Highlights órfãos:** Highlights (`HighlightAnnotation`) que referenciam blockId inexistente são **removidos silenciosamente** (diferente de strokes — highlights sem texto de referência não fazem sentido visual)

**Regras no modelo:**
```typescript
// Annotation é considerada órfã quando:
// - stroke.anchor?.blockId não existe em page.blocks
// - highlight.blockId não existe em page.blocks

// Ação automática ao detectar:
// - Stroke órfão → converter anchor para null (coordenada absoluta)
// - Highlight órfão → remover
```

---

## Modelo de Dados — Stroke (compartilhado)

```typescript
interface Stroke {
  id: string;
  points: StrokePoint[];
  color: string;                 // hex (#RRGGBB)
  size: number;                  // espessura base em pixels
  tool: 'pen' | 'marker' | 'eraser';
  opacity: number;               // 0.0–1.0 (marker usa ~0.4)
  timestamp: number;             // ms desde epoch
}

interface StrokePoint {
  x: number;                     // coordenada X
  y: number;                     // coordenada Y
  pressure: number;              // 0.0–1.0 (0.5 fallback para mouse)
}
```

Usado tanto por InkBlock (coordenadas relativas ao canvas do bloco) quanto por Overlay (coordenadas relativas ao bloco âncora).

---

## Ferramentas de Desenho (compartilhadas)

### Toolbar de Anotação

Ao ativar modo Anotar, uma toolbar fixa aparece no topo da content area:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [✏️ Caneta] [🖍️ Marcador] [📝 Marca-texto] [⬜ Borracha] [⬚ Lasso] │ [Cor ▾] [Esp ▾] │ [↩] [↪] │ [✕ Sair] │
└──────────────────────────────────────────────────────────────────────────┘
```

### Caneta (Pen)

- Traço fino e preciso
- Responde a pressure sensitivity
- Opacidade 100%
- Espessuras: 1, 2, 3, 5, 8 px

### Marcador (Marker)

- Traço solto e grosso
- Opacidade ~40% (semi-transparente)
- Espessuras: 10, 15, 20, 30 px
- Ideal para circular, sublinhar à mão livre

### Marca-texto (Smart Highlighter)

- Se ancora a linhas de texto (snap to text)
- Opacidade ~30%
- Cores claras: amarelo, verde, rosa, azul, roxo
- Diferente do Marcador: retangular, alinhado ao texto

### Borracha (Eraser)

Dois modos:
1. **Stroke eraser** (padrão) — apaga o stroke inteiro ao tocar nele
2. **Point eraser** — apaga apenas a parte tocada (futuro)

### Lasso Select

- Selecionar strokes desenhando um laço ao redor deles
- Strokes selecionados podem ser: movidos, deletados, copiados, recoloridos
- Útil para reorganizar anotações

---

## Paleta de Cores

### Cores Padrão

```
Preto    #1a1a1a
Cinza    #6b7280
Vermelho #ef4444
Azul     #3b82f6
Verde    #22c55e
Amarelo  #eab308
Roxo     #8b5cf6
Laranja  #f97316
```

### Custom Color

- Color picker para cor customizada
- Últimas 4 cores usadas (histórico)
- Cor persiste entre sessões (preferência do workspace)

---

## Rendering

### Canvas API + perfect-freehand

**Biblioteca:** `perfect-freehand` — gera contorno suave a partir de pontos de input + pressão.

```
1. Input: StrokePoint[] (x, y, pressure)
2. perfect-freehand: getStroke(points, options) → outline points
3. Canvas API: fill path com os outline points
```

### Rendering em Duas Camadas (por contexto)

**InkBlock:**
```
┌─────────────────────────────────┐
│  Canvas Layer 1 (committed)     │  ← strokes já salvos (bitmap cache)
├─────────────────────────────────┤
│  Canvas Layer 2 (active)        │  ← stroke sendo desenhado agora
└─────────────────────────────────┘
```

**Overlay:**
```
┌─────────────────────────────────┐
│  SVG Layer (committed strokes)  │  ← strokes salvos (SVG, idle mode)
├─────────────────────────────────┤
│  Canvas Layer (active drawing)  │  ← stroke sendo desenhado agora
└─────────────────────────────────┘
```

Ao finalizar stroke no Overlay:
1. Adicionar stroke ao array
2. Gerar/atualizar SVG com todos os strokes
3. Canvas ativo limpo → SVG exibe tudo

### Resolução e DPI

- Canvas interno: resolução 2x do display (Retina)
- `canvas.width = element.width * devicePixelRatio`
- Coordenadas normalizadas para tamanho lógico

---

## Suporte a Stylus / Tablet

### Pointer Events API

```typescript
canvas.addEventListener('pointerdown', (e: PointerEvent) => {
  // Auto-switch para modo Anotar se input é pen/stylus
  if (e.pointerType === 'pen' && !isAnnotationMode) {
    activateAnnotationMode();
  }

  const point: StrokePoint = {
    x: e.offsetX,
    y: e.offsetY,
    pressure: e.pressure || 0.5,
  };
  startStroke(point, getCurrentTool());
});

canvas.addEventListener('pointermove', (e: PointerEvent) => {
  if (!isDrawing) return;
  const events = e.getCoalescedEvents?.() || [e];
  for (const ce of events) {
    addPoint({
      x: ce.offsetX,
      y: ce.offsetY,
      pressure: ce.pressure || 0.5,
    });
  }
});
```

**`getCoalescedEvents()`:** Captura pontos intermediários entre frames. Essencial para traço suave em tablets de alta frequência.

**Palm rejection:** Quando `pointerType === 'pen'`, ignorar eventos de `touch` simultâneos (mão apoiada na tela).

---

## Export SVG

### Para InkBlock

```typescript
function strokesToSvg(strokes: Stroke[], width: number, height: number): string {
  const paths = strokes.map(stroke => {
    const outline = getStroke(stroke.points, {
      size: stroke.size,
      smoothing: 0.5,
      thinning: 0.5,
      simulatePressure: false,
    });
    const pathData = getSvgPathFromStroke(outline);
    return `<path d="${pathData}" fill="${stroke.color}" opacity="${stroke.opacity}" />`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${paths.join('')}</svg>`;
}
```

### Para Overlay

SVG gerado com dimensões iguais à altura total da page (não viewport). Strokes posicionados com base na âncora resolvida.

---

## Undo/Redo

### Separação por contexto

| Contexto | Scope do Undo |
|---|---|
| TipTap (modo Editar) | Undo/Redo de edição de texto |
| InkBlock (modo Editing) | Undo/Redo de strokes dentro do bloco |
| Overlay (modo Anotar) | Undo/Redo de strokes de anotação da page |

Cada contexto mantém sua própria pilha de undo.

```typescript
interface InkHistory {
  undoStack: InkAction[];
  redoStack: InkAction[];
}

type InkAction =
  | { type: 'add_stroke'; stroke: Stroke }
  | { type: 'remove_stroke'; strokeId: string; stroke: Stroke }
  | { type: 'add_highlight'; highlight: HighlightAnnotation }
  | { type: 'remove_highlight'; highlightId: string }
  | { type: 'clear_all'; strokes: Stroke[] };
```

**Atalhos:**
- `Cmd/Ctrl + Z` → Undo (contexto ativo)
- `Cmd/Ctrl + Shift + Z` → Redo

---

## Componentes

### `<InkOverlay />`

Camada de anotação sobre toda a page.

```typescript
interface InkOverlayProps {
  annotations: PageAnnotations;
  isActive: boolean;                    // modo Anotar ativo?
  contentRef: React.RefObject<HTMLElement>; // referência ao content area (para anchor resolution)
  onAnnotationsChange: (annotations: PageAnnotations) => void;
}
```

**Responsabilidades:**
- Renderizar strokes existentes (SVG quando idle, Canvas quando anotando)
- Capturar input no modo Anotar
- Resolver âncoras (block position → stroke position)
- Re-posicionar strokes quando layout muda

### `<InkBlock />`

Bloco dedicado de desenho.

```typescript
interface InkBlockProps {
  block: InkBlockData;
  onUpdate: (strokes: Stroke[], svgCache: string) => void;
  readOnly?: boolean;
}
```

**Estados:** Idle → Editing → Fullscreen

### `<PdfBlock />`

Bloco de PDF renderizado.

```typescript
interface PdfBlockProps {
  block: PdfBlockData;
  onUpdate: (data: Partial<PdfBlockData>) => void;
}
```

### `<InkCanvas />`

Canvas de desenho reutilizável (usado por InkBlock e InkOverlay).

```typescript
interface InkCanvasProps {
  width: number;
  height: number;
  strokes: Stroke[];
  activeTool: InkTool;
  activeColor: string;
  activeSize: number;
  onStrokeComplete: (stroke: Stroke) => void;
  onStrokeErased: (strokeId: string) => void;
}
```

### `<AnnotationToolbar />`

Toolbar flutuante para modo Anotar.

### `<InkToolbar />`

Toolbar para InkBlock (quando em modo Editing).

### `<ColorPicker />` / `<SizePicker />`

Componentes compartilhados de cor e espessura.

### `<PdfViewer />`

Renderizador de PDF com navegação de páginas.

```typescript
interface PdfViewerProps {
  src: string;                   // path do asset
  displayMode: 'single' | 'continuous';
  initialPage: number;
  scale: number;
  onPageChange: (page: number) => void;
}
```

---

## State Management

### `useAnnotationStore`

```typescript
interface AnnotationStore {
  isAnnotationMode: boolean;
  activeTool: InkTool;
  activeColor: string;
  activeSize: number;
  annotations: PageAnnotations;
  history: InkHistory;

  toggleAnnotationMode: () => void;
  setTool: (tool: InkTool) => void;
  setColor: (color: string) => void;
  setSize: (size: number) => void;
  addStroke: (stroke: AnchoredStroke) => void;
  removeStroke: (id: string) => void;
  addHighlight: (highlight: HighlightAnnotation) => void;
  removeHighlight: (id: string) => void;
  undo: () => void;
  redo: () => void;
}
```

---

## Atalhos de Teclado

| Atalho | Ação |
|---|---|
| `Cmd/Ctrl + Shift + A` | Toggle modo Anotar |
| `P` (no modo Anotar) | Selecionar Caneta |
| `M` (no modo Anotar) | Selecionar Marcador |
| `H` (no modo Anotar) | Selecionar Marca-texto |
| `E` (no modo Anotar) | Selecionar Borracha |
| `L` (no modo Anotar) | Selecionar Lasso |
| `1–8` (no modo Anotar) | Selecionar cor (pela ordem da paleta) |
| `[` / `]` (no modo Anotar) | Diminuir/aumentar espessura |
| `Cmd/Ctrl + Z` | Undo (contexto ativo) |
| `Cmd/Ctrl + Shift + Z` | Redo (contexto ativo) |
| `Esc` | Sair do modo Anotar |
| `F11` | Fullscreen (InkBlock focado) |

---

## Performance

### Otimizações

1. **Two-layer rendering** — Canvas committed + active (InkBlock e Overlay)
2. **SVG para idle** — Overlay exibe SVG quando não está anotando (mais leve)
3. **Lazy canvas init** — InkBlock em idle exibe apenas SVG cache
4. **Point simplification** — Ramer-Douglas-Peucker ao finalizar stroke
5. **OffscreenCanvas** — Renderizar committed strokes em web worker
6. **PDF lazy render** — Renderizar apenas páginas visíveis do PDF
7. **Intersection Observer** — InkBlocks fora do viewport não inicializam canvas
8. **Debounce save** — Annotations salvas com debounce de 2s

### Métricas Alvo

| Métrica | Alvo |
|---|---|
| Latência de ink (pointer → render) | < 8ms |
| Rendering de overlay (1000 strokes, SVG) | < 100ms |
| Abertura de page com PDF (10 páginas) | < 1s |
| Memória por InkBlock (idle) | < 1MB |

### Limites

- Strokes por InkBlock: alertar acima de 1000
- Strokes na annotation layer por page: alertar acima de 2000
- PDF: máximo 500 páginas (alertar, não bloquear)
- Pontos por stroke: simplificar acima de 3000

---

## Subfases de Implementação

Esta fase é grande. Divisão interna recomendada:

### 07a — Ink Engine Core
- Modelo de dados (Stroke, StrokePoint)
- Rendering com perfect-freehand
- Canvas de desenho com two-layer rendering
- Ferramentas: caneta, marcador, borracha
- Paleta de cores e espessuras
- Undo/Redo
- Export SVG
- Point simplification
- Pointer Events + pressure sensitivity

### 07b — Ink Block
- TipTap node extension para InkBlock
- InkBlock component (Idle → Editing → Fullscreen)
- Slash command `/draw`
- Redimensionamento
- Persistência no `.opn.json`

### 07c — Ink Overlay
- Canvas transparente sobre content area
- Toggle modo Editar ↔ Anotar
- Anchoragem de strokes a blocos DOM
- Reposicionamento ao layout change
- SVG overlay para modo idle
- AnnotationToolbar
- Lasso select
- Smart highlighter

### 07d — PDF Block
- Integração pdf.js
- PdfBlock TipTap extension
- Importação de PDF (file picker, drag & drop)
- Renderização contínua e paginada
- Navegação entre páginas
- Anotação sobre PDF via Overlay

---

## Testes

### Unitários

- `getStroke()` gera outline correto
- `strokesToSvg()` gera SVG válido
- Undo/Redo: add → undo → removed → redo → restored
- Point simplification: reduz pontos sem degradação
- Hit test (eraser): detecta colisão corretamente
- Anchor resolution: bloco se move → stroke acompanha
- Highlight annotation: calcula rects corretos para range de texto

### Integração

- InkBlock: desenhar → salvar → reabrir → strokes preservados
- Overlay: anotar sobre texto → salvar → reabrir → annotations preservadas
- PDF: importar → renderizar → anotar → salvar → reabrir → tudo preservado
- Anchor stability: inserir bloco acima → annotations reposicionadas corretamente
- Deletar bloco com annotations → avisar usuário → annotations removidas/preservadas

### E2E

- Criar page → `/draw` → InkBlock criado → desenhar → salvar → reabrir
- Ativar modo Anotar → desenhar sobre texto → sair → annotations visíveis
- Importar PDF → scroll contínuo → anotar página 5 → salvar → reabrir → annotation na página 5
- Smart highlighter → marcar texto → highlight ancorado à linha
- Lasso select → mover strokes → posição atualizada
- Stylus auto-activate → inserir pen → modo Anotar ativado automaticamente

### Manual

- Testar com tablet/stylus → pressure sensitivity funciona
- Testar palm rejection
- Testar latência do traço → < 8ms
- Testar qualidade visual → suave, sem artefatos
- Testar PDF grande (100+ páginas) → scroll suave

---

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Latência de rendering no WebView | Alto | Two-layer canvas, OffscreenCanvas, profiling |
| Pressure sensitivity não funciona em WebView/Tauri | Alto | Testar cedo. Fallback: simular pressão por velocidade |
| Ancoragem de strokes quebra quando layout muda | Alto | Testes extensivos de anchor stability. Snapshot fallback. |
| pdf.js bundle size grande (~1.5MB) | Médio | Lazy loading — só carregar quando PdfBlock existir na page |
| PDF rendering lento (muitas páginas) | Médio | Lazy render (apenas páginas visíveis). Intersection Observer. |
| Muitos strokes no Overlay degradam performance | Médio | SVG para idle, limites, alertas |
| Canvas overlay não recebe eventos em certos WebViews | Médio | Testar cedo com Tauri. Fallback: pointer event interception no JS |
| Smart highlighter falha com layouts complexos (tabelas, columns) | Médio | Limitar a blocos de texto simples inicialmente |

---

## Referências Técnicas

- [perfect-freehand](https://github.com/steveruizok/perfect-freehand) — traço suave
- [tldraw](https://github.com/tldraw/tldraw) — referência de implementação de canvas
- [Pointer Events API](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- [getCoalescedEvents](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents)
- [Ramer-Douglas-Peucker](https://en.wikipedia.org/wiki/Ramer%E2%80%93Douglas%E2%80%93Peucker_algorithm)
- [pdf.js](https://mozilla.github.io/pdf.js/) — renderização de PDF
- [caretRangeFromPoint](https://developer.mozilla.org/en-US/docs/Web/API/Document/caretRangeFromPoint) — detecção de posição no texto
- [Excalidraw](https://github.com/excalidraw/excalidraw) — referência de canvas com collaboration

---

## Definition of Done

### Ink Engine
- [ ] Rendering com perfect-freehand funcionando
- [ ] Ferramentas: caneta, marcador, borracha (stroke eraser)
- [ ] Paleta de cores (8 padrão + custom)
- [ ] Seleção de espessura
- [ ] Pressure sensitivity via Pointer Events
- [ ] Two-layer rendering (committed + active)
- [ ] Undo/Redo de strokes
- [ ] Export SVG
- [ ] Point simplification

### Ink Block
- [ ] InkBlock inserível via `/draw`
- [ ] Canvas dedicado com dimensões configuráveis
- [ ] Redimensionamento (drag handle)
- [ ] Modo tela cheia
- [ ] Lazy initialization (SVG cache quando idle)
- [ ] Strokes persistem no `.opn.json`

### Ink Overlay
- [ ] Canvas transparente sobre toda a page
- [ ] Toggle Editar ↔ Anotar (`Cmd+Shift+A`)
- [ ] Strokes ancorados a blocos DOM
- [ ] Reposicionamento quando layout muda
- [ ] SVG overlay para modo idle
- [ ] Smart highlighter (snap to text lines)
- [ ] Lasso select para mover/deletar strokes
- [ ] Auto-activate com stylus

### PDF
- [ ] PdfBlock inserível via `/pdf`
- [ ] Importação (file picker + drag & drop)
- [ ] Renderização contínua e paginada (pdf.js)
- [ ] Text layer ativo (seleção e cópia de texto do PDF)
- [ ] Navegação entre páginas
- [ ] Anotação sobre PDF via Overlay
- [ ] Annotations ancoradas por página do PDF
- [ ] Pointer events alternando entre text layer (modo normal) e ink overlay (modo anotar)

### Geral
- [ ] Testes unitários passando
- [ ] Testes de integração passando
- [ ] Testes E2E passando
- [ ] Performance: < 8ms latência de ink
- [ ] CI verde

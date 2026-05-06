# ADR-008: Hybrid Ink (Overlay + Block)

## Status
Accepted

## Context
Open Note needs to support handwriting/freehand drawing (ink) for visual annotations. There are two distinct use cases:

1. **Annotating over content** — drawing on top of text, images, PDFs (like marking up a document)
2. **Dedicated freehand drawing** — blank canvas area for sketches, diagrams, visual notes

## Alternatives Considered

| Option | Description |
|---|---|
| **Ink Overlay only** | Transparent canvas over the entire page. Simple, but no dedicated area. |
| **Ink Block only** | Isolated block canvas. Good for drawing, but cannot annotate over text. |
| **Hybrid (Overlay + Block)** | Both modes available. Overlay for annotation, Block for dedicated drawing. |

## Decision
Adopt a **hybrid model** with two independent mechanisms:

### Ink Overlay
- Transparent canvas over the page content
- Strokes anchored to DOM blocks via `StrokeAnchor { block_id, offset_x, offset_y }`
- Activated via the ink toolbar (pen, marker, eraser)
- Strokes stored in `PageAnnotations.strokes`
- Rendering via `perfect-freehand` (pressure points → SVG path)

### Ink Block (`type: "ink"`)
- Dedicated block with an isolated canvas
- Fixed dimensions (width × height)
- Strokes stored inside the block
- Inserted via SlashCommandMenu or drag & drop

## Rationale
- **Flexibility:** Covers both use cases (annotate over content + dedicated drawing)
- **Anchoring:** Overlay strokes move with their block when content is reordered
- **Isolation:** Ink Block has its own canvas, does not interfere with content
- **Performance:** Canvas API is efficient for stroke rendering
- **perfect-freehand:** Smoothing algorithm that transforms pressure points into natural paths

## Stroke Anchoring

```rust
pub struct StrokeAnchor {
    pub block_id: BlockId,     // DOM block the stroke is anchored to
    pub offset_x: f64,         // X offset relative to the block
    pub offset_y: f64,         // Y offset relative to the block
    pub pdf_page: Option<u32>, // PDF page number if inside a PdfBlock
}
```

If the block is deleted, the anchor is `None` and the stroke falls back to absolute coordinates.

## Consequences

### Positive
- Rich UX: annotate over any content + dedicated drawing area
- Strokes survive block reordering (anchoring)
- Pressure support (pen tablets, future Apple Pencil)

### Negative
- Two ink systems to maintain (overlay + block)
- z-index complexity (overlay above content, below modals)
- Canvas API is hard to test with jsdom (excluded from coverage)

### Risks
- Orphaned annotations when blocks are deleted (mitigated: absolute coordinates as fallback)
- Performance with many strokes (mitigated: SVG cache in `PageAnnotations.svg_cache`)

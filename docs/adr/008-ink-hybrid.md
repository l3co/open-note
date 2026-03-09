# ADR-008: Ink Híbrido (Overlay + Block)

## Status
Aceito

## Contexto
O Open Note precisa suportar handwriting/desenho livre (ink) para anotações visuais. Existem dois cenários distintos de uso:

1. **Anotar por cima do conteúdo** — desenhar sobre texto, imagens, PDFs (como marcar um documento)
2. **Desenho livre dedicado** — área em branco para sketches, diagramas, notas visuais

## Alternativas Consideradas

| Opção | Descrição |
|---|---|
| **Ink Overlay only** | Canvas transparente sobre toda a page. Simples, mas sem área dedicada. |
| **Ink Block only** | Bloco de canvas isolado. Bom para desenho, mas não permite anotar sobre texto. |
| **Híbrido (Overlay + Block)** | Ambos os modos disponíveis. Overlay para anotação, Block para desenho dedicado. |

## Decisão
Adotar **modelo híbrido** com dois mecanismos independentes:

### Ink Overlay
- Canvas transparente sobre o conteúdo da page
- Strokes ancorados a blocos DOM via `StrokeAnchor { block_id, offset_x, offset_y }`
- Ativado por toolbar de ink (pen, marker, eraser)
- Strokes armazenados em `PageAnnotations.strokes`
- Renderização via `perfect-freehand` (pontos com pressão → SVG path)

### Ink Block (`type: "ink"`)
- Bloco dedicado com canvas isolado
- Dimensões fixas (width × height)
- Strokes armazenados dentro do bloco
- Inserido via SlashCommandMenu ou drag & drop

## Justificativa
- **Flexibilidade:** Cobre ambos os casos de uso (anotar sobre conteúdo + desenho dedicado)
- **Ancoragem:** Strokes do overlay se movem com o bloco quando o conteúdo muda
- **Isolamento:** Ink Block tem seu próprio canvas, não interfere com o conteúdo
- **Performance:** Canvas API é eficiente para renderização de strokes
- **perfect-freehand:** Algoritmo de suavização que transforma pontos com pressão em paths naturais

## Ancoragem de Strokes

```rust
pub struct StrokeAnchor {
    pub block_id: BlockId,    // Bloco DOM ao qual o stroke está ancorado
    pub offset_x: f64,        // Offset X relativo ao bloco
    pub offset_y: f64,        // Offset Y relativo ao bloco
    pub pdf_page: Option<u32>, // Se dentro de um PdfBlock
}
```

Se o bloco é deletado, o anchor é `None` e o stroke fica em coordenadas absolutas.

## Consequências

### Positivas
- UX rica: anotar sobre qualquer conteúdo + desenho dedicado
- Strokes sobrevivem a reordenação de blocos (ancoragem)
- Suporte a pressão (pen tablets, Apple Pencil futuro)

### Negativas
- Dois sistemas de ink para manter (overlay + block)
- Complexidade de z-index (overlay acima do conteúdo, abaixo de modais)
- Canvas API difícil de testar com jsdom (excluído de coverage)

### Riscos
- Annotations órfãs quando blocos são deletados (mitigado: coordenadas absolutas como fallback)
- Performance com muitos strokes (mitigado: SVG cache em `PageAnnotations.svg_cache`)

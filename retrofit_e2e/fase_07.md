# Fase 07 - Handwriting, Ink & PDF

## Feature: Camada de Anotação Overlay e Blocos Manuscritos

**Descrição**: Validar inputs do ponteiro (mouse/pen) no InkCanvas com perfect-freehand, InkOverlay sobre o editor RichText, InkBlock dedicado, e visualização de PDF via pdfjs-dist.

**Componentes envolvidos:** `InkOverlay`, `InkCanvas`, `InkBlockComponent`, `InkToolbar`, `PdfViewer`, `PdfBlockComponent`

**State:** `useAnnotationStore` (Zustand) — strokes, highlights, tool settings

### Caminho Feliz (Happy Path)
```gherkin
Feature: Ink e PDF
  Scenario: Desenhando no InkBlock dedicado
    Given o usuário inseriu um InkBlock na página
    Then o InkCanvas é exibido com toolbar (InkToolbar) para pen/eraser/color
    When o usuário arrasta o mouse ou pen no canvas
    Then stroke paths são desenhados com perfect-freehand (sensibilidade a pressão)
    And os strokes são persistidos no bloco como array de StrokePoint[] via auto-save

  Scenario: InkOverlay sobre o editor RichText
    Given o InkOverlay está ativo sobre o ContentArea
    When o usuário rabisca sobre o texto existente
    Then os strokes são renderizados como camada SVG por cima do editor
    And os strokes são salvos no useAnnotationStore com referência ao bloco

  Scenario: Inserindo e visualizando PDF
    Given o usuário insere um PdfBlock via SlashCommand ou IPC import_pdf
    When o PDF é carregado via pdfjs-dist
    Then as páginas do PDF são renderizadas in-situ com paginação navegável
    And o usuário pode navegar entre páginas do documento
```

### Caminho Crítico (Critical Path)
```gherkin
Feature: Resiliência de Ink e PDF
  Scenario: Anotações órfãs quando bloco é deletado
    Given o InkOverlay tem strokes vinculados a um bloco de texto
    When o bloco de texto é removido pelo backspace
    Then os strokes órfãos são removidos do useAnnotationStore
    And o overlay reflete a remoção imediatamente (sem strokes fantasma)

  Scenario: PDF com muitas páginas
    Given o usuário carrega um PDF de 200+ páginas via PdfBlockComponent
    When o componente renderiza
    Then apenas as páginas visíveis são renderizadas (lazy rendering)
    And a navegação entre páginas é fluida
    And o consumo de memória da WebView não causa crash

  Scenario: PDF com arquivo não encontrado
    Given um PdfBlock referencia um arquivo que foi deletado do filesystem
    When a página é renderizada
    Then o PdfBlockComponent exibe mensagem de erro ("Arquivo não encontrado")
    And o editor não quebra — os demais blocos renderizam normalmente
```

> **⚠️ Limitações conhecidas:**
> - **Anchor-based reflow:** O InkOverlay posiciona strokes via coordenadas absolutas relativas ao ContentArea. Se o layout do texto muda (resize, edição), os strokes **não** acompanham automaticamente o texto. Strokes ancorados (AnchoredStroke com blockId e offset) existem no modelo, mas o reflow preciso ainda é parcial.
> - **Highlight annotations:** O modelo suporta `HighlightAnnotation` com posições no texto, mas a interação completa (selecionar texto → highlight → persistir) pode estar incompleta.

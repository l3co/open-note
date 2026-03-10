# Roadmap — Integração Excalidraw (Canvas Page)

## Visão Geral

Adicionar um novo modo de página **Canvas** ao Open Note, que funciona como um
whiteboard infinito estilo Excalidraw. O usuário cria uma página do tipo canvas
e obtém um ambiente de desenho completo: formas geométricas, setas, texto livre,
desenho à mão (freehand), pan/zoom, seleção e estilo.

O estado do canvas é persistido em formato JSON aberto no campo `canvas_state`
do `.opn.json` da página — alinhado ao princípio **local-first** do projeto.

---

## Decisão Arquitetural

### Abordagem adotada: `@excalidraw/excalidraw` (pacote npm oficial)

| Critério | Decisão |
|---|---|
| **Funcionalidade** | Excalidraw oferece shapes, arrows, freehand, text, seleção, undo/redo, zoom nativo |
| **Manutenção** | Mantido pela equipe Excalidraw (Meta Open Source) |
| **Formato de dado** | JSON aberto, human-readable, exportável — compatível com local-first |
| **Bundle** | Carregado via lazy import (`React.lazy`) — sem impacto no tempo de startup |
| **Tema** | Suporta `theme="dark"` e `theme="light"` — integra com o sistema de temas existente |
| **Alternativa descartada** | Construir do zero estenderia o prazo em meses sem ganho real |

### Modo de página vs. bloco

O Canvas é implementado como **modo de página inteiro** (`EditorMode::Canvas`),
análogo ao `EditorMode::PdfCanvas` já existente — e não como um bloco dentro do
editor rich-text. Isso porque:

- O canvas precisa de toda a área da janela para ser útil
- Pan/zoom e teclado conflitam com o editor TipTap
- A experiência é conceptualmente uma nota separada, não conteúdo misto

---

## Estrutura de Dados

### Novo campo na `Page` (Rust)

```rust
// crates/core/src/page.rs
pub struct Page {
    // ... campos existentes ...
    #[serde(default)]
    pub canvas_state: Option<serde_json::Value>,
}
```

### Novo valor em `EditorMode` (Rust)

```rust
pub enum EditorMode {
    RichText,
    Markdown,
    PdfCanvas,
    Canvas,   // NOVO
}
```

### Formato JSON salvo no `.opn.json`

```json
{
  "editor_preferences": { "mode": "canvas", "split_view": false },
  "canvas_state": {
    "elements": [
      {
        "type": "rectangle",
        "id": "abc123",
        "x": 100, "y": 150,
        "width": 200, "height": 100,
        "strokeColor": "#1e1e1e",
        "backgroundColor": "transparent"
      }
    ],
    "appState": {
      "viewBackgroundColor": "#ffffff"
    },
    "files": {}
  }
}
```

---

## Fases de Implementação

| Fase | Escopo | Dependências | Estimativa |
|---|---|---|---|
| [Fase 01](./fase_01.md) | Rust core — `EditorMode::Canvas` + `canvas_state` na `Page` | — | ~2h |
| [Fase 02](./fase_02.md) | IPC Rust + TypeScript bindings + `ipc.ts` | Fase 01 | ~2h |
| [Fase 03](./fase_03.md) | Frontend — `CanvasPage` component + Excalidraw wrap | Fase 02 | ~4h |
| [Fase 04](./fase_04.md) | UI — `PageView` routing + `SectionOverview` + i18n | Fase 03 | ~3h |
| [Fase 05](./fase_05.md) | Testes — unit Rust + Vitest + E2E Playwright | Fase 04 | ~3h |

**Total estimado: ~14h de desenvolvimento**

---

## Arquivos Afetados por Fase

### Fase 01 — Rust Core
```
crates/core/src/page.rs          # EditorMode::Canvas + canvas_state + Page::new_canvas()
src/types/bindings/EditorMode.ts # gerado automaticamente via ts-rs
src/types/bindings/Page.ts       # gerado automaticamente via ts-rs
```

### Fase 02 — IPC
```
src-tauri/src/commands/page.rs   # create_canvas_page + update_page_canvas_state
src-tauri/src/lib.rs             # registrar novos commands
src/lib/ipc.ts                   # createCanvasPage + updatePageCanvasState
```

### Fase 03 — Frontend Component
```
package.json                              # @excalidraw/excalidraw
src/components/canvas/CanvasPage.tsx      # componente principal
src/components/canvas/CanvasToolbar.tsx   # barra de título + botão exportar (opcional)
```

### Fase 04 — UI Integration
```
src/components/pages/PageView.tsx         # branch mode === "canvas"
src/components/pages/SectionOverview.tsx  # botão "Nova página canvas"
src/locales/en.json                       # keys canvas.*
src/locales/pt-BR.json                    # keys canvas.*
src/components/layout/ContextMenu.tsx     # item "New Canvas Page" (se existir)
```

### Fase 05 — Testes
```
crates/core/src/page.rs                        # #[cfg(test)] inline
src/components/canvas/__tests__/CanvasPage.test.tsx
e2e/fase-06-canvas-page.spec.ts
```

---

## Critérios de Aceite (Definition of Done)

- [ ] Usuário consegue criar uma página do tipo Canvas pela `SectionOverview`
- [ ] O canvas abre em tela cheia com todas as ferramentas do Excalidraw
- [ ] Alterações são auto-salvas em ≤ 2 segundos após a última mudança
- [ ] Ao reabrir a página, o estado do canvas é restaurado integralmente
- [ ] O tema do canvas (claro/escuro) segue o tema global do app
- [ ] O campo `canvas_state` é `null` enquanto não houver conteúdo (zero-byte overhead)
- [ ] Páginas canvas existentes (sem `canvas_state`) carregam sem erro (retrocompatibilidade)
- [ ] Bindings TypeScript gerados pelo `ts-rs` estão atualizados no CI
- [ ] Cobertura de testes unitários Rust ≥ 90% no `crates/core/src/page.rs`

---

## Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Bundle do Excalidraw aumentar tempo de carregamento | Média | Usar `React.lazy` + `Suspense` para lazy load apenas quando canvas é aberto |
| Conflito de atalhos de teclado (Cmd+Z, Ctrl+Z) | Baixa | Excalidraw gerencia seu próprio undo internamente; verificar que o InkOverlay não interfere |
| `canvas_state` muito grande (centenas de elementos) | Baixa | JSON comprimido pelo Excalidraw; monitorar via `SOFT_BLOCK_LIMIT` analógico futuro |
| Compatibilidade do Excalidraw com Tauri WebView | Baixa | Excalidraw usa Canvas API e APIs web padrão; testar em WebKit (macOS) e WebView2 (Windows) |

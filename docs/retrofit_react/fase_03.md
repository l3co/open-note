# Fase 03 — Lazy Loading & Code Splitting (Tauri-safe)

**Esforço estimado:** ~12 horas  
**Impacto:** 🔴 CRÍTICO  
**Dependências:** Nenhuma (pode ser feita em paralelo com Fase 01/02)  
**Branch:** `refactor/lazy-loading`

---

## Objetivo

Implementar code splitting com `React.lazy` + `Suspense` para reduzir o bundle inicial e acelerar o startup da aplicação Tauri. Componentes pesados (editor, PDF, ink, settings) devem ser carregados sob demanda.

**Regra Vercel:** `bundle-dynamic-imports` — Usar imports dinâmicos para componentes pesados.

---

## Diagnóstico do Bundle Atual

### Imports estáticos no `App.tsx`

```tsx
// App.tsx — TUDO importado estaticamente
import { TrashPanel } from "@/components/shared/TrashPanel";
import { QuickOpen } from "@/components/search/QuickOpen";
import { SearchPanel } from "@/components/search/SearchPanel";
import { SyncSettings } from "@/components/sync/SyncSettings";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { OnboardingDialog } from "@/components/onboarding/OnboardingDialog";
```

**Todos renderizados condicionalmente** (`if (!show) return null`), mas **carregados no bundle principal.**

### Imports estáticos no Editor

```tsx
// BlockEditor.tsx — 15+ extensões TipTap importadas estaticamente
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
// ... + 10 mais extensões
import { common, createLowlight } from "lowlight";
```

### Estimativa de Impacto por Componente

| Componente | Deps pesadas | Bundle estimado | Quando carregado |
|-----------|-------------|----------------|-----------------|
| `BlockEditor` | TipTap + 15 exts + Lowlight | ~250-300 KB | Ao abrir page |
| `MarkdownEditor` | CodeMirror 6 | ~150-200 KB | Ao trocar modo |
| `PdfViewer` | pdfjs-dist | ~400+ KB | Ao abrir bloco PDF |
| `InkOverlay` + `InkCanvas` | perfect-freehand | ~30-50 KB | Ao ativar ink mode |
| `SettingsDialog` | 6 sub-sections | ~20 KB | Ao abrir settings |
| `SyncSettings` | Sync types | ~15 KB | Ao abrir sync |
| `OnboardingDialog` | Steps + ilustrações | ~10 KB | Apenas first-run |
| `TrashPanel` | Lista + IPC | ~8 KB | Ao abrir trash |
| `SearchPanel` | Search types | ~8 KB | Ao abrir search |

**Bundle total estimado que pode ser deferido: ~900 KB - 1 MB**

---

## Considerações Tauri-Específicas

1. **Sem SSR:** `React.lazy` funciona diretamente, sem necessidade de `next/dynamic`
2. **Assets locais:** O bundle é local (WebView carrega do filesystem), então latência de chunk é mínima (~1-5ms)
3. **Vite code splitting:** Vite (bundler do Tauri) suporta `import()` nativamente → gera chunks separados
4. **Startup time:** Mesmo sendo local, um bundle menor = parse/eval mais rápido → app abre mais rápido
5. **Memory:** Chunks carregados sob demanda = menor footprint inicial do WebView

---

## Tarefas

### 3.1 — Lazy load dos modais no App.tsx

**Arquivo:** `src/App.tsx`

**Antes:**
```tsx
import { TrashPanel } from "@/components/shared/TrashPanel";
import { QuickOpen } from "@/components/search/QuickOpen";
import { SearchPanel } from "@/components/search/SearchPanel";
import { SyncSettings } from "@/components/sync/SyncSettings";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { OnboardingDialog } from "@/components/onboarding/OnboardingDialog";
```

**Depois:**
```tsx
import { lazy, Suspense } from "react";

const TrashPanel = lazy(() => import("@/components/shared/TrashPanel").then(m => ({ default: m.TrashPanel })));
const QuickOpen = lazy(() => import("@/components/search/QuickOpen").then(m => ({ default: m.QuickOpen })));
const SearchPanel = lazy(() => import("@/components/search/SearchPanel").then(m => ({ default: m.SearchPanel })));
const SyncSettings = lazy(() => import("@/components/sync/SyncSettings").then(m => ({ default: m.SyncSettings })));
const SettingsDialog = lazy(() => import("@/components/settings/SettingsDialog").then(m => ({ default: m.SettingsDialog })));
const OnboardingDialog = lazy(() => import("@/components/onboarding/OnboardingDialog").then(m => ({ default: m.OnboardingDialog })));
```

**Uso com Suspense:**
```tsx
<Suspense fallback={null}>
  <TrashPanel />
  <QuickOpen />
  <SearchPanel />
  <SyncSettings />
  <SettingsDialog />
  {showOnboarding && <OnboardingDialog onComplete={...} />}
</Suspense>
```

**Nota:** `fallback={null}` é adequado porque esses componentes já retornam `null` quando `!show`. O chunk é carregado ao primeiro render, e como são modais, a latência de ~5ms é imperceptível.

**Critérios:**
- [ ] 6 componentes lazy-loaded
- [ ] `Suspense` com fallback adequado
- [ ] Nenhuma mudança visual ou comportamental
- [ ] Build gera chunks separados (verificar `dist/assets/`)

---

### 3.2 — Lazy load do MarkdownEditor no PageEditor

**Arquivo:** `src/components/editor/PageEditor.tsx`

O `MarkdownEditor` (CodeMirror 6) só é usado quando o usuário troca para modo markdown. Deve ser carregado sob demanda.

**Antes:**
```tsx
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
```

**Depois:**
```tsx
const MarkdownEditor = lazy(() =>
  import("@/components/editor/MarkdownEditor").then(m => ({ default: m.MarkdownEditor }))
);

// No JSX:
{mode === "markdown" ? (
  <Suspense fallback={<EditorSkeleton />}>
    <MarkdownEditor content={markdownContent} onChange={handleMarkdownChange} theme={cmTheme} />
  </Suspense>
) : (
  <BlockEditor ... />
)}
```

**Critérios:**
- [ ] CodeMirror 6 em chunk separado
- [ ] Skeleton placeholder durante carregamento
- [ ] Troca de modo funciona sem delay perceptível (preload on hover, Tarefa 3.6)

---

### 3.3 — Lazy load do PdfViewer

**Arquivo:** `src/components/editor/extensions/PdfBlockNodeView.tsx`

O `pdfjs-dist` (~400 KB) só é necessário quando há um bloco PDF na page.

```tsx
const PdfViewer = lazy(() =>
  import("@/components/pdf/PdfViewer").then(m => ({ default: m.PdfViewer }))
);
```

**Critérios:**
- [ ] `pdfjs-dist` em chunk separado
- [ ] Placeholder com ícone de PDF durante carregamento
- [ ] Funciona com scroll para múltiplos PDFs na mesma page

---

### 3.4 — Lazy load do InkOverlay

**Arquivo:** `src/components/editor/PageEditor.tsx`

O `InkOverlay` (canvas + perfect-freehand) só é necessário quando annotation mode está ativo.

```tsx
const InkOverlay = lazy(() =>
  import("@/components/ink/InkOverlay").then(m => ({ default: m.InkOverlay }))
);

// No JSX:
<Suspense fallback={null}>
  <InkOverlay contentRef={contentAreaRef} />
</Suspense>
```

**Nota:** O InkOverlay já verifica `isAnnotationMode` internamente. O lazy é um safety net para o chunk.

**Critérios:**
- [ ] `perfect-freehand` em chunk separado
- [ ] Ink mode funciona normalmente após carregamento

---

### 3.5 — Criar componente `EditorSkeleton`

**Arquivo:** `src/components/editor/EditorSkeleton.tsx`

Placeholder visual para enquanto o editor carrega:

```tsx
export function EditorSkeleton() {
  return (
    <div className="animate-pulse space-y-3 py-4" data-testid="editor-skeleton">
      <div className="h-4 w-3/4 rounded bg-[var(--bg-tertiary)]" />
      <div className="h-4 w-full rounded bg-[var(--bg-tertiary)]" />
      <div className="h-4 w-5/6 rounded bg-[var(--bg-tertiary)]" />
      <div className="h-4 w-2/3 rounded bg-[var(--bg-tertiary)]" />
    </div>
  );
}
```

**Critérios:**
- [ ] Visual coerente com o tema (usa CSS variables)
- [ ] Animação pulse sutil
- [ ] Usado como fallback do Suspense

---

### 3.6 — Preload on hover para EditorModeToggle

**Regra Vercel:** `bundle-preload` — Preload on hover/focus para perceived speed.

**Arquivo:** `src/components/editor/EditorModeToggle.tsx`

Quando o usuário hover sobre o botão "Markdown", iniciar o preload do chunk:

```tsx
const preloadMarkdownEditor = () => {
  import("@/components/editor/MarkdownEditor");
};

<button
  onMouseEnter={preloadMarkdownEditor}
  onFocus={preloadMarkdownEditor}
  onClick={() => onChange("markdown")}
>
  Markdown
</button>
```

**Critérios:**
- [ ] Chunk começa a carregar no hover (antes do click)
- [ ] Preload idempotente (não carrega 2x)
- [ ] Troca de modo perceptivelmente instantânea para o usuário

---

### 3.7 — Verificar chunks gerados pelo Vite

**Ação:** Após implementação, executar build e verificar splitting:

```bash
npm run build
ls -la dist/assets/*.js | sort -k5 -n
```

**Chunks esperados:**
- `index-[hash].js` — Bundle principal (reduzido)
- `MarkdownEditor-[hash].js` — CodeMirror
- `PdfViewer-[hash].js` — pdfjs-dist
- `InkOverlay-[hash].js` — Canvas + perfect-freehand
- `SettingsDialog-[hash].js` — Settings
- Vários chunks menores para modais

**Critérios:**
- [ ] Bundle principal reduzido em pelo menos 30%
- [ ] Chunks separados gerados para componentes pesados
- [ ] Nenhum chunk > 500 KB (pdfjs pode ser exceção)

---

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/App.tsx` | Lazy imports para 6 modais |
| `src/components/editor/PageEditor.tsx` | Lazy MarkdownEditor + InkOverlay |
| `src/components/editor/extensions/PdfBlockNodeView.tsx` | Lazy PdfViewer |
| `src/components/editor/EditorSkeleton.tsx` | **Novo** — placeholder |
| `src/components/editor/EditorModeToggle.tsx` | Preload on hover |

---

## Critérios de Aceitação

- [ ] Bundle principal reduzido (verificar com `npm run build`)
- [ ] Modais carregam sob demanda sem delay perceptível
- [ ] Editor Markdown carrega com skeleton + preload on hover
- [ ] PDF viewer carrega sob demanda
- [ ] App inicia e funciona normalmente
- [ ] Testes existentes passam
- [ ] `npm run build` sem warnings
- [ ] PR review aprovado

# Fase 01 — Tokens & Tipografia

**Esforço estimado:** ~2 horas
**Prioridade:** 🔴 Crítica
**Dependências:** Nenhuma
**Branch:** `feat/redesign-plataforma-phase-1`

---

## Objetivo

Estabelecer a base do novo design system: refinar o font stack para system-ui moderno, adicionar tokens de CSS (border-radius, shadows em escala de elevação, accent palette) para os **3 temas** (light, dark, paper), criar a classe `.card-interactive` em `interactive.css`, e ajustar transições globais. Esta fase não toca em nenhum componente — apenas CSS.

**Decisões aplicadas:**
- **D1** — System Font Stack (sem Google Fonts, sem CDN, zero dependência de rede)
- **D2** — Classe `.card-interactive` em CSS (não inline JS)

---

## Contexto Atual

### Font Stack
```css
/* src/styles/globals.css — linha 105-107 */
body {
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
    Arial, sans-serif;
}
```
Stack genérico sem `system-ui`. Apps modernos (VS Code, Figma, Slack) usam `system-ui` como primeira opção — renderiza a fonte nativa de cada OS (SF Pro no macOS, Segoe UI no Windows, Roboto no Android).

### Tokens de Sombra e Raio
```css
/* globals.css — light theme */
--shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
--shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.1);
/* Não há: --shadow-card, --shadow-hover, --radius-*, --shadow-dropdown, --shadow-modal */
```

Faltam tokens para:
- Sombra de hover em cards (`--shadow-card-hover`)
- Escala de border-radius consistente (`--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`)
- Sombra de elementos elevados como modais e dropdowns
- **Tema Paper** tem `--shadow` e `--shadow-lg` com tons warm (`rgba(100, 70, 30, ...)`) — novos tokens devem seguir essa tonalidade

### interactive.css — padrões existentes
```css
/* interactive.css já tem: .interactive-ghost, .interactive-subtle, .interactive-danger, .interactive-accent */
/* Todos seguem o padrão: base + :hover + :focus-visible + :disabled + [data-active] */
/* Falta: .card-interactive (para cards com shadow + border accent dinâmico) */
```

---

## Tarefas

### 1.1 — Atualizar font-family para system-ui moderno

**Arquivo:** `src/styles/globals.css`

```css
/* Antes: */
body {
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
    Arial, sans-serif;
}

/* Depois: */
body {
  font-family:
    system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
```

**Critérios:**
- [ ] `system-ui` como primeira opção — resolve para SF Pro (macOS), Segoe UI (Windows), Roboto (Linux)
- [ ] Removidos Helvetica Neue e Arial (redundantes com system-ui)
- [ ] `-webkit-font-smoothing: antialiased` já presente — preservar
- [ ] Zero dependência de rede — tudo local

---

### 1.2 — Adicionar tokens de border-radius e shadow (3 temas)

**Arquivo:** `src/styles/globals.css`

Adicionar na seção `:root` (compartilhado):

```css
:root {
  /* Border radius scale */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
}
```

Adicionar dentro do bloco **light** `:root, [data-theme="light"]`:

```css
  /* Card shadows — light */
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-card-hover: 0 4px 12px rgba(0, 0, 0, 0.10), 0 2px 4px rgba(0, 0, 0, 0.06);
  --shadow-dropdown: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-modal: 0 16px 48px rgba(0, 0, 0, 0.18), 0 4px 16px rgba(0, 0, 0, 0.10);
```

Adicionar dentro do bloco **paper** `[data-theme="paper"]`:

```css
  /* Card shadows — paper (tons warm para harmonizar com bg) */
  --shadow-card: 0 1px 3px rgba(100, 70, 30, 0.06), 0 1px 2px rgba(100, 70, 30, 0.04);
  --shadow-card-hover: 0 4px 12px rgba(100, 70, 30, 0.10), 0 2px 4px rgba(100, 70, 30, 0.06);
  --shadow-dropdown: 0 8px 24px rgba(100, 70, 30, 0.12), 0 2px 8px rgba(100, 70, 30, 0.08);
  --shadow-modal: 0 16px 48px rgba(100, 70, 30, 0.18), 0 4px 16px rgba(100, 70, 30, 0.10);
```

Adicionar dentro do bloco **dark** `[data-theme="dark"]`:

```css
  /* Card shadows — dark (opacidade aumentada para compensar fundo escuro) */
  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.30), 0 1px 2px rgba(0, 0, 0, 0.20);
  --shadow-card-hover: 0 4px 12px rgba(0, 0, 0, 0.45), 0 2px 4px rgba(0, 0, 0, 0.30);
  --shadow-dropdown: 0 8px 24px rgba(0, 0, 0, 0.50), 0 2px 8px rgba(0, 0, 0, 0.35);
  --shadow-modal: 0 16px 48px rgba(0, 0, 0, 0.60), 0 4px 16px rgba(0, 0, 0, 0.45);
```

**Critérios:**
- [ ] Tokens de raio em `:root` (compartilhado, independente de tema)
- [ ] Shadows diferenciadas por nível de elevação (card < dropdown < modal)
- [ ] **3 temas**: light (tons neutros), paper (tons warm), dark (opacidade alta)
- [ ] Tokens existentes (`--shadow`, `--shadow-lg`) preservados — novos tokens são adicionais

---

### 1.3 — Adicionar tokens de cor de accent para cards coloridos

**Arquivo:** `src/styles/globals.css`

Adicionar na seção `:root` (compartilhado):

```css
:root {
  /* Accent palette para cards (usado via section.color.hex) */
  --color-blue: #3b82f6;
  --color-purple: #8b5cf6;
  --color-pink: #ec4899;
  --color-green: #22c55e;
  --color-orange: #f97316;
  --color-yellow: #eab308;
  --color-teal: #14b8a6;
  --color-red: #ef4444;
}
```

**Critérios:**
- [ ] 8 cores de accent disponíveis como tokens
- [ ] Compatíveis com o sistema de `section.color.hex` existente

---

### 1.4 — Criar classe `.card-interactive` em interactive.css

**Arquivo:** `src/styles/interactive.css`

Adicionar ao final do arquivo, seguindo o padrão existente (`base + :hover + :focus-visible + :disabled`):

```css
/* Card interativo com shadow e border accent dinâmico.
   Uso: className="card-interactive" + style={{ '--card-accent': accentColor }}
   A custom property --card-accent define a cor do hover/focus (default: --accent). */
.card-interactive {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition:
    box-shadow 150ms ease,
    border-color 150ms ease,
    transform 100ms ease;
  outline: none;
}
.card-interactive:hover:not(:disabled) {
  box-shadow: var(--shadow-card-hover);
  border-color: color-mix(in srgb, var(--card-accent, var(--accent)) 40%, transparent);
}
.card-interactive:active:not(:disabled) {
  transform: scale(0.99);
}
.card-interactive:focus-visible {
  box-shadow: var(--shadow-card-hover);
  outline: 2px solid var(--card-accent, var(--accent));
  outline-offset: 2px;
}
.card-interactive:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**Critérios:**
- [ ] Segue o padrão de `.interactive-ghost` (base + :hover + :focus-visible + :disabled)
- [ ] Cor do hover/focus é dinâmica via `--card-accent` (fallback para `--accent`)
- [ ] `:hover` usa `color-mix()` para 40% de opacidade na border (sutil)
- [ ] `:focus-visible` garante acessibilidade por teclado
- [ ] `:active` com `scale(0.99)` para feedback tátil
- [ ] `transition` cobre `box-shadow`, `border-color` e `transform`
- [ ] Funciona com os 3 temas (shadows via CSS variables)

---

### 1.5 — Transição global mais suave

**Arquivo:** `src/styles/globals.css`

```css
/* Antes: */
* {
  transition:
    background-color 200ms ease,
    color 200ms ease,
    border-color 200ms ease;
}

/* Depois: */
* {
  transition:
    background-color 150ms ease,
    color 150ms ease,
    border-color 150ms ease,
    box-shadow 150ms ease,
    opacity 150ms ease;
}
```

**Critérios:**
- [ ] Velocidade reduzida de 200ms para 150ms (mais snappy)
- [ ] `box-shadow` e `opacity` incluídos para animar cards hover suavemente

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `src/styles/globals.css` | Alteração — font-family, tokens de radius, shadow (3 temas), accent palette, transições |
| `src/styles/interactive.css` | Alteração — nova classe `.card-interactive` |

## Arquivos NÃO Modificados

- `index.html` — **Sem mudanças** (sem Google Fonts)
- `src/components/` — Nenhum componente tocado nesta fase
- `Cargo.toml`, `package.json` — Sem mudanças
- `crates/` — Sem mudanças Rust

---

## Critérios de Aceitação da Fase

- [ ] `npm run typecheck` sem erros
- [ ] `npm run dev` inicia, font stack system-ui aplicado
- [ ] Temas light/dark/paper continuam funcionando sem perda de contraste
- [ ] `.card-interactive` funcional em todos os 3 temas (testar manualmente)
- [ ] `cargo test --workspace` passa (nenhum Rust tocado)
- [ ] Snapshots atualizados onde necessário
- [ ] PR review aprovado

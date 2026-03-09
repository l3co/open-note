# ADR-006: Sistema de Temas com 3 Camadas

## Status
Aceito

## Contexto
O Open Note precisa de um sistema de personalização visual que ofereça variedade sem complexidade excessiva. Inspirado em apps como Todoist e TickTick, o objetivo é um visual premium com personalização rica.

## Decisão
Adotar um sistema de temas com **3 camadas independentes**:

1. **Base Theme** — Esquema de cores fundamental (light, dark, paper, system)
2. **Accent Color** — Cor de destaque da UI (10 paletas)
3. **Chrome Tint** — Tonalidade do chrome/sidebar (neutral ou tinted)

## Implementação

### Base Themes

| Tema | Estilo | Inspiração |
|---|---|---|
| `light` | Branco limpo | Notion, Linear |
| `paper` | Creme/sépia | Kindle, iA Writer |
| `dark` | Escuro profundo | VS Code, Obsidian |
| `system` | Segue o OS | matchMedia |

Aplicado via `<html data-theme="dark">` com CSS custom properties.

### Accent Colors (10 paletas)

Blue, Indigo, Purple, Berry, Red, Orange, Amber, Green, Teal, Graphite.

Cada paleta gera 4 variantes CSS:
- `--accent-base` — cor principal
- `--accent-hover` — hover state
- `--accent-subtle` — 10% opacity (backgrounds)
- `--accent-on` — texto sobre accent

### Chrome Tint

- `neutral` — sidebar/toolbar com cinza neutro
- `tinted` — sidebar/toolbar com tonalidade suave da accent color via `color-mix(in srgb, var(--accent-base) 8%, var(--chrome-bg))`

Aplicado via `<html data-chrome="tinted">`.

### Persistência

```rust
pub struct ThemeConfig {
    pub base_theme: BaseTheme,     // light, dark, paper, system
    pub accent_color: String,       // "Blue", "Indigo", etc.
    pub chrome_tint: ChromeTint,    // neutral, tinted
}
```

Persistido em `GlobalSettings.theme` → `~/.opennote/app_state.json`.

## Justificativa
- **3 camadas independentes** permitem combinações ricas (3 × 10 × 2 = 60 variações) sem complexidade de implementação
- **CSS custom properties** permitem troca instantânea sem re-render do React
- **System theme** acompanha preferência do OS automaticamente
- **Paper theme** diferencia o app de concorrentes (experiência de leitura)

## Consequências

### Positivas
- UX premium com personalização visual rica
- Troca de tema instantânea (zero flicker)
- Fácil de adicionar novos temas base ou paletas no futuro
- Acessível: contraste garantido em todas as combinações

### Negativas
- CSS mais complexo (variáveis aninhadas, color-mix)
- Necessidade de testar todas as combinações visualmente

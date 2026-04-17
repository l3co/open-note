# ADR-006: 3-Layer Theme System

## Status
Accepted

## Context
Open Note needs a visual customization system that offers variety without excessive complexity. Inspired by apps like Todoist and TickTick, the goal is a premium look with rich personalization.

## Decision
Adopt a theme system with **3 independent layers**:

1. **Base Theme** — fundamental color scheme (light, dark, paper, system)
2. **Accent Color** — UI highlight color (10 palettes)
3. **Chrome Tint** — chrome/sidebar tint (neutral or tinted)

## Implementation

### Base Themes

| Theme | Style | Inspiration |
|---|---|---|
| `light` | Clean white | Notion, Linear |
| `paper` | Cream/sepia | Kindle, iA Writer |
| `dark` | Deep dark | VS Code, Obsidian |
| `system` | Follows OS | matchMedia |

Applied via `<html data-theme="dark">` with CSS custom properties.

### Accent Colors (10 palettes)

Blue, Indigo, Purple, Berry, Red, Orange, Amber, Green, Teal, Graphite.

Each palette generates 4 CSS variants:
- `--accent-base` — primary color
- `--accent-hover` — hover state
- `--accent-subtle` — 10% opacity (backgrounds)
- `--accent-on` — text on accent

### Chrome Tint

- `neutral` — sidebar/toolbar with neutral gray
- `tinted` — sidebar/toolbar with a soft tint of the accent color via `color-mix(in srgb, var(--accent-base) 8%, var(--chrome-bg))`

Applied via `<html data-chrome="tinted">`.

### Persistence

```rust
pub struct ThemeConfig {
    pub base_theme: BaseTheme,     // light, dark, paper, system
    pub accent_color: String,       // "Blue", "Indigo", etc.
    pub chrome_tint: ChromeTint,    // neutral, tinted
}
```

Persisted in `GlobalSettings.theme` → `~/.opennote/app_state.json`.

## Rationale
- **3 independent layers** allow rich combinations (3 × 10 × 2 = 60 variations) without implementation complexity
- **CSS custom properties** allow instant theme switching with zero React re-renders
- **System theme** automatically follows OS preferences
- **Paper theme** differentiates the app from competitors (reading experience)

## Consequences

### Positive
- Premium UX with rich visual customization
- Instant theme switching (zero flicker)
- Easy to add new base themes or palettes in the future
- Accessible: contrast guaranteed in all combinations

### Negative
- More complex CSS (nested variables, color-mix)
- All combinations require visual testing

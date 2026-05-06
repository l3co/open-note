# ADR-009: react-i18next for Internationalization

## Status
Accepted

## Context
Open Note needs to support multiple languages. The initial audience is Brazilian (pt-BR) with expansion to English (en). The solution must allow language switching without restart and be extensible for new languages.

## Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| **react-i18next** | Mature, native React hooks, pluralization, interpolation, lazy loading | Additional dependency |
| **react-intl (FormatJS)** | ICU message format, good for complex plurals | More verbose API, more complex setup |
| **DIY (Context + JSON)** | No dependency, full control | Reinventing the wheel, no pluralization/interpolation |
| **next-intl** | Optimized for Next.js | Coupled to Next.js, not applicable here |

## Decision
Adopt **react-i18next** with `i18next` as the engine.

## Implementation

### Configuration

```typescript
// src/lib/i18n.ts
i18n.use(initReactI18next).init({
  resources: { 'pt-BR': ptBR, en },
  lng: 'pt-BR',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
```

### Languages

| Language | Code | Status | Keys |
|---|---|---|---|
| Portuguese (Brazil) | `pt-BR` | Default | 250+ |
| English | `en` | Fallback | 250+ |

### Usage in components

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t('myComponent.title')}</h1>;
}
```

### Rules

1. **No visible hardcoded strings** — everything via `t('key')`
2. **Keys organized by component/feature** in the JSON files
3. **Backend errors:** Rust returns an error code (e.g. `NOTEBOOK_ALREADY_EXISTS`), frontend translates
4. **Switch without restart:** `i18n.changeLanguage('en')` re-renders everything
5. **Persistence:** `GlobalSettings.language` in `app_state.json`

### Locale structure

```
src/locales/
├── pt-BR.json    # 250+ keys
└── en.json       # 250+ keys
```

## Rationale
- **react-i18next** is the de facto standard for i18n in React
- `useTranslation()` hook integrates naturally with functional components
- Automatic fallback: if a key doesn't exist in pt-BR, uses en
- Interpolation: `t('greeting', { name: 'John' })` → "Hello, John!"
- Extensible: adding a new language is just creating a JSON file and registering it

## Consequences

### Positive
- Multilingual support from the start
- Instant language switching
- Easy to add new languages (JSON only)
- Clear separation between code and text

### Negative
- Every visible string must go through `t()` (requires discipline)
- Large JSON files (250+ keys each)
- Keeping languages in sync requires attention

### Risks
- Missing keys in one language (mitigated: fallback to en)
- Untranslated strings (mitigated: PR review)

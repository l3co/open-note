# ADR-005: Zustand for State Management

## Status
Accepted

## Context
The React frontend needs a state management solution for global state (workspace, navigation, current page, UI, annotations). The solution must be lightweight, typeable, and require minimal boilerplate.

## Alternatives Considered

| Option | Pros | Cons |
|---|---|---|
| **Zustand** | Minimal boilerplate, native TypeScript, no providers, simple API | Less structure than Redux |
| **Redux Toolkit** | Mature, excellent DevTools, middleware | Boilerplate (slices, actions, reducers), overhead |
| **Jotai** | Atomic, minimal, bottom-up | Less intuitive for complex state |
| **React Context** | Native, no dependency | Excessive re-renders, does not scale |

## Decision
Adopt **Zustand** as the state management library.

## Rationale
- **Simplicity:** A store is a function that returns state + actions — no reducers, actions, or dispatchers
- **TypeScript:** Complete typing without extra annotations
- **No Provider:** No `<Provider>` wrapping the app tree needed
- **Performance:** Granular selectors avoid unnecessary re-renders
- **Size:** ~1KB gzipped
- **Outside React access:** `useStore.getState()` works in any context (useful for IPC callbacks)

## Consequences

### Positive
- 5 stores separated by domain (SRP):
  - `useWorkspaceStore` — workspace, notebooks, sections
  - `useNavigationStore` — selection, expand/collapse, history
  - `usePageStore` — current page, save status
  - `useUIStore` — sidebar, theme, modals
  - `useAnnotationStore` — ink strokes, highlights
- Async actions are natural (call IPC then update state)
- Testable: stores can be tested in isolation

### Negative
- No logging/devtools middleware by default (can be added)
- Separate stores may fall out of sync if actions are poorly coordinated

### Risks
- Inconsistent state between stores (mitigated: coordinated actions, tests)

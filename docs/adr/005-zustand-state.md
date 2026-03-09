# ADR-005: Zustand como State Management

## Status
Aceito

## Contexto
O frontend React precisa de uma solução de state management para gerenciar estado global (workspace, navegação, page atual, UI, anotações). A solução deve ser leve, tipável, e não exigir boilerplate excessivo.

## Alternativas Consideradas

| Opção | Prós | Contras |
|---|---|---|
| **Zustand** | Mínimo boilerplate, TypeScript nativo, sem providers, API simples | Menos structure que Redux |
| **Redux Toolkit** | Maduro, DevTools excelentes, middleware | Boilerplate (slices, actions, reducers), overhead |
| **Jotai** | Atômico, mínimo, bottom-up | Menos intuitivo para estado complexo |
| **React Context** | Nativo, sem dependência | Re-renders excessivos, não escala |

## Decisão
Adotar **Zustand** como biblioteca de state management.

## Justificativa
- **Simplicidade:** Store é uma função que retorna estado + ações — sem reducers, actions, dispatchers
- **TypeScript:** Tipagem completa sem annotations extras
- **Sem Provider:** Não precisa de `<Provider>` wrapping a app tree
- **Performance:** Selectors granulares evitam re-renders desnecessários
- **Tamanho:** ~1KB gzipped
- **Acesso fora do React:** `useStore.getState()` funciona em qualquer contexto (útil para IPC callbacks)

## Consequências

### Positivas
- 5 stores separados por domínio (SRP):
  - `useWorkspaceStore` — workspace, notebooks, sections
  - `useNavigationStore` — seleção, expand/collapse, histórico
  - `usePageStore` — page atual, save status
  - `useUIStore` — sidebar, tema, modais
  - `useAnnotationStore` — ink strokes, highlights
- Ações assíncronas naturais (chamam IPC e atualizam state)
- Testável: stores podem ser testados isoladamente

### Negativas
- Sem middleware de logging/devtools por padrão (adicionável)
- Stores separados podem ficar desincronizados se mal gerenciados

### Riscos
- State inconsistente entre stores (mitigado: ações coordenadas, testes)

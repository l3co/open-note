# Multiple Workspaces — Roadmap

## Visão Geral

Permitir que o Open Note gerencie **múltiplos workspaces simultaneamente**, possibilitando que o usuário alterne entre diferentes contextos (trabalho, pessoal, estudos) sem fechar e reabrir workspaces. Inspirado no modelo de janelas/tabs de editores como VS Code.

---

## Estado Atual (Single Workspace)

### Arquitetura Existente

```
AppManagedState
├── workspace_root: Mutex<Option<PathBuf>>     ← ÚNICO workspace ativo
├── save_coordinator: SaveCoordinator           ← locks por page_id (global)
├── search_engine: Mutex<Option<SearchEngine>>  ← UMA instância Tantivy
└── sync_coordinator: Mutex<Option<SyncCoord.>> ← UM coordenador de sync
```

### Fluxo Atual
1. Usuário abre/cria workspace via `WorkspacePicker`
2. `AppManagedState.workspace_root` recebe `Some(path)`
3. Search engine e Sync coordinator são inicializados para ESSE workspace
4. Todos os IPC commands (notebook, section, page, search, trash) lêem `workspace_root` do state
5. Para trocar de workspace: `close_workspace()` → WorkspacePicker → `open_workspace()`

### Pontos de Acoplamento Identificados

| Camada | Arquivo | Acoplamento |
|--------|---------|-------------|
| **Tauri State** | `src-tauri/src/state.rs` | `workspace_root: Mutex<Option<PathBuf>>` — singletão |
| **IPC Commands** | `src-tauri/src/commands/*.rs` | Todos usam `state.get_workspace_root()` |
| **Search** | `state.rs` → `SearchEngine` | Uma instância global |
| **Sync** | `state.rs` → `SyncCoordinator` | Uma instância global |
| **Lock** | `crates/storage/src/lock.rs` | `.lock` file por workspace |
| **Frontend Store** | `src/stores/useWorkspaceStore.ts` | `workspace: Workspace | null` — singular |
| **Navigation** | `src/stores/useNavigationStore.ts` | Estado global sem contexto de workspace |
| **UI Store** | `src/stores/useUIStore.ts` | `showWorkspacePicker` — binário |
| **App.tsx** | `src/App.tsx` | Renderiza WorkspacePicker OU editor (nunca ambos) |
| **AppState** | `crates/core/src/settings.rs` | `last_opened_workspace: Option<PathBuf>` — singular |

---

## Avaliação de Complexidade

### Classificação: 🟠 ALTA (Score: 7/10)

**Justificativa:**

| Fator | Impacto | Nota |
|-------|---------|------|
| Mudanças no domínio (`crates/core`) | Médio — `AppState` precisa de `active_workspaces: Vec<>` | 3/5 |
| Mudanças no storage (`crates/storage`) | Baixo — engine já recebe `root_path`, sem state global | 1/5 |
| Mudanças no Tauri state (`src-tauri`) | **Alto** — `AppManagedState` precisa virar multi-workspace | 5/5 |
| Mudanças nos IPC commands | **Alto** — todos os 30+ commands precisam de `workspace_id` | 5/5 |
| Mudanças no frontend (stores) | **Alto** — stores precisam de namespace por workspace | 5/5 |
| Mudanças na UI (componentes) | Médio — sidebar com workspace switcher, tabs/painel | 3/5 |
| Search engine (Tantivy) | Médio — uma instância por workspace ou índice unificado | 3/5 |
| Sync coordinator | Baixo — já recebe `workspace_root` | 2/5 |
| Testes existentes | Médio — ~270 linhas de testes de workspace store + integração | 3/5 |

**Estimativa de esforço total: ~120-160 horas de desenvolvimento**

### Riscos Principais

1. **Migração de dados** — `app_state.json` muda de schema; workspaces existentes precisam de migration
2. **Memory footprint** — múltiplos SearchEngine/SyncCoordinator na memória
3. **Lock contention** — múltiplos workspaces com locks simultâneos
4. **UX complexity** — troca de contexto sem confundir o usuário
5. **Regressão** — 30+ IPC commands precisam aceitar `workspace_id`

---

## Estratégia de Implementação

### Princípio: Incremental, Backward Compatible

Cada fase entrega valor independente e pode ser merged em `main` sem quebrar funcionalidade existente.

### Fases

| Fase | Nome | Esforço | Prioridade | Dependências |
|------|------|---------|------------|--------------|
| 1 | **Workspace Registry** — domínio e storage | ~20h | 🔴 Crítica | — |
| 2 | **Multi-Workspace State** — Tauri backend | ~30h | 🔴 Crítica | Fase 1 |
| 3 | **IPC Commands Migration** — workspace_id em todos os commands | ~25h | 🔴 Crítica | Fase 2 |
| 4 | **Frontend Stores Refactor** — namespace por workspace | ~25h | 🔴 Crítica | Fase 3 |
| 5 | **UI — Workspace Switcher & Tabs** | ~20h | 🟡 Alta | Fase 4 |
| 6 | **Search Multi-Index** — Tantivy por workspace | ~15h | 🟡 Alta | Fase 2 |
| 7 | **Data Migration & Backward Compat** | ~10h | 🟡 Alta | Fase 1 |
| 8 | **Testes E2E & Polish** | ~15h | 🟢 Média | Todas |

---

## Modelo de Domínio Proposto

### Antes (Single)
```
AppState
├── recent_workspaces: Vec<RecentWorkspace>
├── last_opened_workspace: Option<PathBuf>
└── global_settings: GlobalSettings
```

### Depois (Multi)
```
AppState
├── recent_workspaces: Vec<RecentWorkspace>
├── active_workspaces: Vec<ActiveWorkspace>     ← NOVO
├── focused_workspace_id: Option<WorkspaceId>   ← NOVO
└── global_settings: GlobalSettings

ActiveWorkspace                                  ← NOVO
├── id: WorkspaceId
├── path: PathBuf
├── name: String
└── opened_at: DateTime<Utc>
```

### Tauri State (Depois)
```
AppManagedState
├── workspaces: Mutex<HashMap<WorkspaceId, WorkspaceContext>>  ← NOVO
├── focused_workspace_id: Mutex<Option<WorkspaceId>>           ← NOVO
└── save_coordinator: SaveCoordinator

WorkspaceContext                                                ← NOVO
├── root_path: PathBuf
├── search_engine: SearchEngine
└── sync_coordinator: SyncCoordinator
```

---

## Critérios de Aceitação (Definição de Done)

- [ ] Usuário pode abrir 2+ workspaces simultaneamente
- [ ] Sidebar mostra workspace ativo com switcher rápido
- [ ] Busca funciona em cada workspace independente
- [ ] Fechar um workspace não afeta os outros
- [ ] Workspaces existentes (v1) migram automaticamente
- [ ] Todos os testes existentes continuam passando
- [ ] Novos testes cobrem cenários multi-workspace
- [ ] Performance: abrir 5 workspaces não degrada UX significativamente
- [ ] Memory: cada workspace adicional usa < 50MB extra

---

## Referências

- `docs/ARCHITECTURE.md` — Arquitetura atual
- `docs/DATA_MODEL.md` — Modelo de dados
- `docs/SYSTEM_DESIGN.md` — Design do sistema
- `crates/core/src/workspace.rs` — Domínio do workspace
- `crates/core/src/settings.rs` — AppState
- `src-tauri/src/state.rs` — Tauri managed state
- `src/stores/useWorkspaceStore.ts` — Store frontend

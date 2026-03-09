# Fase 06 — Search Multi-Index (Tantivy por Workspace)

**Esforço estimado:** ~15 horas  
**Prioridade:** 🟡 Alta  
**Dependências:** Fase 02  
**Branch:** `feat/multi-workspace-phase-6`

---

## Objetivo

Garantir que cada workspace aberto tenha sua própria instância de `SearchEngine` (Tantivy) com índice isolado, e implementar busca cross-workspace opcional.

---

## Contexto Atual

### Índice Tantivy

Cada workspace já tem seu próprio diretório de índice:
```
<workspace_root>/.opennote/index/
```

O problema é que `AppManagedState` mantém **uma única instância** de `SearchEngine`:
```rust
pub search_engine: Mutex<Option<SearchEngine>>,
```

Ao trocar de workspace, a engine é substituída. Na Fase 02, cada `WorkspaceContext` terá sua própria `Option<SearchEngine>`, resolvendo o problema base.

### Search Engine Atual

```rust
// crates/search/src/engine.rs
pub struct SearchEngine {
    index: Index,
    reader: IndexReader,
    writer: Mutex<IndexWriter<TantivyDocument>>,
    schema: SearchSchema,
}
```

A engine é stateful — `IndexWriter` mantém lock exclusivo no diretório. **Não é possível** ter dois `SearchEngine` apontando para o mesmo diretório.

---

## Tarefas

### 6.1 — Validar isolamento de instâncias Tantivy

**Arquivo:** `crates/search/src/engine.rs`

Adicionar teste de integração que abre dois `SearchEngine` em diretórios diferentes simultaneamente:

```rust
#[test]
fn two_engines_different_dirs_coexist() {
    let dir_a = tempfile::tempdir().unwrap();
    let dir_b = tempfile::tempdir().unwrap();

    let engine_a = SearchEngine::open_or_create(dir_a.path()).unwrap();
    let engine_b = SearchEngine::open_or_create(dir_b.path()).unwrap();

    // Index page in A
    engine_a.index_page(&make_page("Page in A")).unwrap();
    // Index page in B
    engine_b.index_page(&make_page("Page in B")).unwrap();

    // Search in A — should NOT find B's page
    let results_a = engine_a.search(&SearchQuery { text: "Page in B".into(), ..default() }).unwrap();
    assert_eq!(results_a.total, 0);

    // Search in B — should NOT find A's page
    let results_b = engine_b.search(&SearchQuery { text: "Page in A".into(), ..default() }).unwrap();
    assert_eq!(results_b.total, 0);
}
```

**Critérios:**
- [ ] Duas instâncias em dirs diferentes não interferem
- [ ] Indexação em A não aparece em B
- [ ] Ambas podem commitar simultaneamente

---

### 6.2 — Lifecycle da SearchEngine no WorkspaceContext

**Arquivo:** `src-tauri/src/state.rs`

Garantir que `WorkspaceContext` inicializa e limpa a engine corretamente:

```rust
impl WorkspaceContext {
    pub fn init_search(&mut self) -> Result<(), CommandError> {
        let index_dir = self.root_path.join(".opennote").join("index");
        self.search_engine = Some(SearchEngine::open_or_create(&index_dir)?);
        Ok(())
    }

    pub fn with_search<F, R>(&self, f: F) -> Result<R, CommandError>
    where
        F: FnOnce(&SearchEngine) -> Result<R, CommandError>,
    {
        let engine = self.search_engine.as_ref()
            .ok_or_else(|| CommandError::Internal("Search not initialized".into()))?;
        f(engine)
    }
}
```

**Critérios:**
- [ ] Init lazy — chamado em `open_workspace`, não no construtor
- [ ] Falha na init não impede abertura do workspace (warn + continua)
- [ ] Drop do WorkspaceContext libera o index writer

---

### 6.3 — Drop seguro do SearchEngine

**Arquivo:** `crates/search/src/engine.rs`

Verificar/implementar `Drop` para `SearchEngine` que:
1. Faz commit de pending writes
2. Libera o write lock no diretório

```rust
impl Drop for SearchEngine {
    fn drop(&mut self) {
        if let Ok(mut writer) = self.writer.lock() {
            let _ = writer.commit();
        }
    }
}
```

**Critérios:**
- [ ] Nenhum dado pendente perdido ao fechar workspace
- [ ] Diretório destrancado após drop
- [ ] Teste: cria engine, indexa sem commit, drop, reabre → dados presentes

---

### 6.4 — Busca Cross-Workspace (opcional, futura)

**Arquivo:** `src-tauri/src/commands/search.rs`

Novo command para buscar em todos os workspaces abertos:

```rust
#[tauri::command]
pub fn search_all_workspaces(
    state: State<AppManagedState>,
    query: SearchQuery,
) -> Result<Vec<CrossWorkspaceResult>, CommandError> {
    let workspaces = state.list_open_workspaces()?;
    let mut all_results = Vec::new();

    for (ws_id, ws_name) in &workspaces {
        if let Ok(results) = state.with_search_engine_for(ws_id, |engine| {
            engine.search(&query).map_err(|e| CommandError::Internal(e.to_string()))
        }) {
            for item in results.items {
                all_results.push(CrossWorkspaceResult {
                    workspace_id: *ws_id,
                    workspace_name: ws_name.clone(),
                    result: item,
                });
            }
        }
    }

    // Sort by score descending
    all_results.sort_by(|a, b| b.result.score.partial_cmp(&a.result.score).unwrap_or(std::cmp::Ordering::Equal));
    all_results.truncate(query.limit);

    Ok(all_results)
}
```

**Struct:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct CrossWorkspaceResult {
    pub workspace_id: WorkspaceId,
    pub workspace_name: String,
    pub result: SearchResultItem,
}
```

**Critérios:**
- [ ] Busca em paralelo (ou sequencial se mutex) em todos os workspaces
- [ ] Resultados mesclados e ordenados por score
- [ ] Limite global aplicado
- [ ] Indicador de qual workspace cada resultado pertence
- [ ] Pode ser implementado em fase posterior — struct e command definidos agora

---

### 6.5 — Memory footprint: estimativa e monitoramento

**Análise:**

Cada `SearchEngine` (Tantivy) consome:
- ~5-10 MB de RAM para o index reader (warm cache)
- ~50-100 MB para index writer buffer (configurável via `IndexWriter::new(heap_size)`)

**Ação:** Reduzir o writer heap size para workspaces não-focused:

```rust
const WRITER_HEAP_SIZE_FOCUSED: usize = 50_000_000;  // 50 MB
const WRITER_HEAP_SIZE_BACKGROUND: usize = 10_000_000; // 10 MB
```

Ao trocar de foco, redimensionar o writer (ou usar lazy commit + flush).

**Critérios:**
- [ ] Monitorar RAM com 5 workspaces (cada com ~100 pages)
- [ ] Target: < 300 MB total para 5 workspaces
- [ ] Log de memória ao abrir/fechar workspaces

---

### 6.6 — Testes

| Teste | Arquivo | Descrição |
|-------|---------|-----------|
| `two_engines_isolated` | `crates/search` | Dados não vazam entre engines |
| `engine_drop_commits` | `crates/search` | Drop faz commit dos dados pendentes |
| `workspace_context_init_search` | `src-tauri` | Init cria engine funcional |
| `workspace_context_search_isolated` | `src-tauri` | Busca scoped por workspace |
| `search_all_workspaces_merges` | `src-tauri` | Cross-workspace retorna de ambos |

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `crates/search/src/engine.rs` | Drop impl, testes de isolamento |
| `src-tauri/src/state.rs` | WorkspaceContext search lifecycle |
| `src-tauri/src/commands/search.rs` | `search_all_workspaces` command |
| `src/types/bindings/CrossWorkspaceResult.ts` | Novo (gerado) |
| `src/lib/ipc.ts` | Novo wrapper `searchAllWorkspaces` |

---

## Critérios de Aceitação da Fase

- [ ] Cada workspace tem índice Tantivy isolado
- [ ] Busca em workspace A não retorna resultados de B
- [ ] Drop da engine não perde dados
- [ ] Cross-workspace search funcional (pelo menos no backend)
- [ ] RAM < 300 MB com 5 workspaces abertos (100 pages cada)
- [ ] `cargo test --workspace` passa
- [ ] PR review aprovado

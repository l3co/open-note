# Fase 00 — Backend Prep

**Esforço estimado:** ~4 horas
**Prioridade:** 🔴 Crítica
**Dependências:** Nenhuma
**Branch:** `feat/redesign-plataforma-phase-0`

---

## Objetivo

Preparar a camada backend para suportar três features que o redesign visual consome:

1. **Quick Notes** — auto-criação de notebook/section "Quick Notes" para o CTA "Nova Página" da sidebar
2. **PageSummary.preview** — preview de ~80 caracteres do conteúdo para exibir nos cards da HomePage
3. **get_random_pages** — IPC command que retorna N páginas aleatórias para o "Random Note Spotlight"

Esta fase **não toca em nenhum componente frontend**. Apenas `crates/core`, `crates/storage`, `src-tauri/commands` e `src/lib/ipc.ts` (binding).

---

## Contexto Atual

### WorkspaceSettings já tem os campos de Quick Notes

```rust
// crates/core/src/workspace.rs — linha 51-54
#[serde(default)]
pub quick_notes_notebook_id: Option<NotebookId>,
#[serde(default)]
pub quick_notes_section_id: Option<SectionId>,
```

Os campos existem mas **não há lógica de auto-criação**. O frontend (`HomePage.tsx`) já lê `quick_notes_section_id` e usa como fallback para criar páginas, mas se o campo for `None`, cai no primeiro section disponível ou abre quick-open.

### PageSummary não tem preview

```rust
// crates/core/src/page.rs — PageSummary
pub struct PageSummary {
    pub id: PageId,
    pub title: String,
    pub tags: Vec<String>,
    pub mode: EditorMode,
    pub block_count: usize,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_protected: bool,
}
```

Sem campo `preview`. O `list_pages` lê a `Page` completa e converte via `From<&Page>`, então o conteúdo dos blocks está disponível no momento da conversão.

### Não existe IPC para random pages

O único mecanismo de "recentes" é o `history` no `useNavigationStore` (frontend-only). Não há IPC que retorne páginas aleatórias do workspace.

---

## Tarefas

### 0.1 — Adicionar campo `preview` ao PageSummary

**Arquivo:** `crates/core/src/page.rs`

Adicionar campo opcional ao `PageSummary`:

```rust
pub struct PageSummary {
    pub id: PageId,
    pub title: String,
    pub tags: Vec<String>,
    pub mode: EditorMode,
    pub block_count: usize,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(default)]
    pub is_protected: bool,
    #[serde(default)]
    pub preview: Option<String>,  // NEW — primeiros ~80 chars do conteúdo
}
```

Atualizar o `From<&Page>`:

```rust
impl From<&Page> for PageSummary {
    fn from(page: &Page) -> Self {
        Self {
            id: page.id,
            title: page.title.clone(),
            tags: page.tags.clone(),
            mode: page.editor_preferences.mode,
            block_count: page.blocks.len(),
            created_at: page.created_at,
            updated_at: page.updated_at,
            is_protected: page.protection.is_some(),
            preview: extract_preview(&page.blocks, 80),
        }
    }
}
```

Adicionar função pura para extração de preview:

```rust
/// Extrai os primeiros `max_chars` de texto do primeiro TextBlock ou MarkdownBlock.
/// Retorna None se não houver conteúdo textual.
fn extract_preview(blocks: &[Block], max_chars: usize) -> Option<String> {
    for block in blocks {
        let text = match block {
            Block::Text(b) => {
                // TipTap content é JSON: {"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"..."}]}]}
                extract_text_from_tiptap(&b.content)
            }
            Block::Markdown(b) => Some(b.content.clone()),
            Block::Code(b) => Some(b.content.clone()),
            _ => continue,
        };

        if let Some(text) = text {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                let preview = if trimmed.len() > max_chars {
                    let mut end = max_chars;
                    // Corta na última palavra completa
                    if let Some(pos) = trimmed[..max_chars].rfind(' ') {
                        end = pos;
                    }
                    format!("{}…", &trimmed[..end])
                } else {
                    trimmed.to_string()
                };
                return Some(preview);
            }
        }
    }
    None
}

/// Extrai texto puro de um JSON TipTap de forma recursiva.
fn extract_text_from_tiptap(value: &serde_json::Value) -> Option<String> {
    let mut result = String::new();
    collect_tiptap_text(value, &mut result);
    if result.is_empty() {
        None
    } else {
        Some(result)
    }
}

fn collect_tiptap_text(value: &serde_json::Value, out: &mut String) {
    match value {
        serde_json::Value::Object(map) => {
            if let Some(text) = map.get("text").and_then(|v| v.as_str()) {
                if !out.is_empty() {
                    out.push(' ');
                }
                out.push_str(text);
            }
            if let Some(content) = map.get("content").and_then(|v| v.as_array()) {
                for item in content {
                    collect_tiptap_text(item, out);
                }
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr {
                collect_tiptap_text(item, out);
            }
        }
        _ => {}
    }
}
```

**Critérios:**
- [ ] `preview` é `Option<String>` — `None` para pages sem conteúdo textual
- [ ] Trunca em ~80 chars na última palavra completa + `…`
- [ ] Funciona para TextBlock (TipTap JSON), MarkdownBlock e CodeBlock
- [ ] Pages protegidas retornam `None` (blocks vazios no summary)
- [ ] `#[derive(TS)]` gera binding TypeScript atualizado
- [ ] Testes unitários para `extract_preview` com edge cases

---

### 0.2 — Implementar lógica de Quick Notes (ensure_quick_notes)

**Arquivo:** `crates/storage/src/engine.rs`

Adicionar método que garante a existência de notebook/section Quick Notes e atualiza `WorkspaceSettings`:

```rust
/// Garante que o workspace tem um notebook/section "Quick Notes".
/// Se já existir (IDs válidos no settings), retorna o section_id existente.
/// Se não existir, cria notebook "Quick Notes" + section "Notes" e salva os IDs no settings.
pub fn ensure_quick_notes(workspace_root: &Path) -> StorageResult<SectionId> {
    let mut ws = Self::load_workspace(workspace_root)?;

    // Verifica se o section_id atual ainda é válido
    if let Some(section_id) = ws.settings.quick_notes_section_id {
        if Self::find_section_dir(workspace_root, section_id).is_ok() {
            return Ok(section_id);
        }
    }

    // Verifica se o notebook_id atual ainda é válido
    let notebook_id = if let Some(nb_id) = ws.settings.quick_notes_notebook_id {
        if Self::find_notebook_dir(workspace_root, nb_id).is_ok() {
            nb_id
        } else {
            // Notebook deletado — criar novo
            let nb = Self::create_notebook(workspace_root, "Quick Notes")?;
            nb.id
        }
    } else {
        let nb = Self::create_notebook(workspace_root, "Quick Notes")?;
        nb.id
    };

    // Criar section dentro do notebook
    let section = Self::create_section(workspace_root, notebook_id, "Notes")?;

    // Atualizar settings
    ws.settings.quick_notes_notebook_id = Some(notebook_id);
    ws.settings.quick_notes_section_id = Some(section.id);
    Self::update_workspace(workspace_root, &ws)?;

    Ok(section.id)
}
```

**Critérios:**
- [ ] Idempotente — se Quick Notes já existe, retorna o section_id existente
- [ ] Valida que os IDs salvos no settings ainda apontam para entidades existentes
- [ ] Se o notebook foi deletado, recria
- [ ] Atualiza `WorkspaceSettings` com os novos IDs
- [ ] Testes de integração com filesystem real

---

### 0.3 — IPC command `ensure_quick_notes`

**Arquivo:** `src-tauri/src/commands/workspace.rs`

```rust
#[tauri::command]
pub fn ensure_quick_notes(
    state: State<AppManagedState>,
    workspace_id: Option<String>,
) -> Result<String, CommandError> {
    let root = super::resolve_root(&state, workspace_id)?;
    let section_id = FsStorageEngine::ensure_quick_notes(&root)
        .map_err(CommandError::from)?;
    Ok(section_id.to_string())
}
```

Registrar no `.invoke_handler()` em `lib.rs`.

**Arquivo:** `src/lib/ipc.ts`

```typescript
export async function ensureQuickNotes(workspaceId?: string): Promise<string> {
  return invoke<string>("ensure_quick_notes", { workspaceId });
}
```

**Critérios:**
- [ ] Command registrado e funcional
- [ ] Frontend pode chamar `ipc.ensureQuickNotes()` para obter section_id
- [ ] Retorna section_id como string (consistente com outros commands)

---

### 0.4 — IPC command `get_random_pages`

**Arquivo:** `crates/storage/src/engine.rs`

```rust
/// Retorna até `count` PageSummary aleatórios do workspace, excluindo os IDs em `exclude_ids`.
/// Útil para "Random Note Spotlight" na HomePage.
pub fn get_random_pages(
    workspace_root: &Path,
    count: usize,
    exclude_ids: &[PageId],
) -> StorageResult<Vec<PageSummary>> {
    let notebooks = Self::list_notebooks(workspace_root)?;
    let mut all_summaries: Vec<PageSummary> = Vec::new();

    for notebook in &notebooks {
        let sections = Self::list_sections(workspace_root, notebook.id)?;
        for section in &sections {
            let pages = Self::list_pages(workspace_root, section.id)?;
            all_summaries.extend(
                pages.into_iter()
                    .filter(|p| !p.is_protected && !exclude_ids.contains(&p.id))
            );
        }
    }

    // Shuffle e pegar os primeiros `count`
    use rand::seq::SliceRandom;
    let mut rng = rand::rng();
    all_summaries.shuffle(&mut rng);
    all_summaries.truncate(count);

    Ok(all_summaries)
}
```

**Arquivo:** `src-tauri/src/commands/page.rs`

```rust
#[tauri::command]
pub fn get_random_pages(
    state: State<AppManagedState>,
    count: usize,
    exclude_ids: Vec<String>,
    workspace_id: Option<String>,
) -> Result<Vec<PageSummary>, CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    let exclude: Vec<PageId> = exclude_ids
        .iter()
        .filter_map(|s| s.parse().ok())
        .collect();
    FsStorageEngine::get_random_pages(&root, count, &exclude)
        .map_err(CommandError::from)
}
```

**Arquivo:** `src/lib/ipc.ts`

```typescript
export async function getRandomPages(
  count: number,
  excludeIds: string[],
  workspaceId?: string,
): Promise<PageSummary[]> {
  return invoke<PageSummary[]>("get_random_pages", { count, excludeIds, workspaceId });
}
```

**Critérios:**
- [ ] Retorna até `count` pages aleatórios (default: 3)
- [ ] Exclui pages protegidas (não faz sentido mostrar "[Página protegida]" no spotlight)
- [ ] Exclui IDs fornecidos em `exclude_ids` (para não repetir recent pages)
- [ ] Preview de conteúdo incluído nos summaries retornados
- [ ] Testes unitários e de integração

---

### 0.5 — Atualizar bindings TypeScript

Após modificar `PageSummary`, regenerar os bindings:

```bash
cargo test --workspace  # ts-rs gera bindings durante os testes
```

Verificar que `src/types/bindings/PageSummary.ts` agora inclui `preview: string | null`.

**Critérios:**
- [ ] `PageSummary.ts` atualizado com campo `preview`
- [ ] `npm run typecheck` sem erros
- [ ] Nenhum componente frontend quebrado (campo é `Option` com `serde(default)`)

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `crates/core/src/page.rs` | Alteração — `PageSummary.preview` + `extract_preview()` |
| `crates/storage/src/engine.rs` | Alteração — `ensure_quick_notes()` + `get_random_pages()` |
| `src-tauri/src/commands/workspace.rs` | Alteração — IPC `ensure_quick_notes` |
| `src-tauri/src/commands/page.rs` | Alteração — IPC `get_random_pages` |
| `src-tauri/src/lib.rs` | Alteração — registrar novos commands |
| `src/lib/ipc.ts` | Alteração — `ensureQuickNotes()` + `getRandomPages()` |
| `src/types/bindings/PageSummary.ts` | Auto-gerado — campo `preview` |

## Arquivos NÃO Modificados

- `src/components/` — Nenhum componente frontend tocado
- `src/stores/` — Nenhuma store modificada
- `src/styles/` — Nenhum CSS tocado
- `crates/search/` — Sem mudanças no índice
- `crates/sync/` — Sem mudanças

---

## Critérios de Aceitação da Fase

- [ ] `cargo test --workspace` passa (incluindo novos testes)
- [ ] `cargo clippy --workspace -- -D warnings` sem warnings
- [ ] `npm run typecheck` sem erros
- [ ] `npm run test` — testes frontend existentes passando
- [ ] `PageSummary` binding gerado com campo `preview`
- [ ] `ensure_quick_notes` funcional: cria notebook/section se não existir, retorna section_id
- [ ] `get_random_pages` funcional: retorna pages aleatórios com preview
- [ ] PR review aprovado

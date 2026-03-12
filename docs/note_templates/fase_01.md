# Fase 01 — Domínio + Storage + IPC

**Esforço estimado:** ~8 horas
**Prioridade:** 🔴 Crítica
**Dependências:** Nenhuma
**Branch:** `feat/note-templates-phase-1`

---

## Objetivo

Criar a entidade `NoteTemplate` no domínio puro (`crates/core`), persistência no filesystem (`crates/storage`), e os IPC commands básicos (`src-tauri/commands/`). Ao fim desta fase, o backend está completo e funcional, com TypeScript bindings gerados — pronto para ser consumido pelo frontend na Fase 2.

---

## Contexto Atual

### Padrão de Newtype ID (crates/core/src/id.rs)

```rust
macro_rules! define_id {
    ($name:ident) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
        #[ts(export, export_to = "../../../src/types/bindings/")]
        pub struct $name(Uuid);

        impl $name {
            pub fn new() -> Self { Self(Uuid::new_v4()) }
        }
        // ... From<Uuid>, Display, Default
    };
}
define_id!(WorkspaceId);
define_id!(PageId);
// ... adicionar TemplateId aqui
```

### Primitivo `create_page_from` já existe em storage (crates/storage/src/engine.rs:376-387)

```rust
pub fn create_page_from(
    workspace_root: &Path,
    section_id: SectionId,
    page: Page,
) -> StorageResult<Page> {
    let (_nb_dir, sec_dir) = Self::find_section_dir(workspace_root, section_id)?;
    let existing_slugs = Self::existing_page_slugs(&sec_dir)?;
    let slug = unique_slug(&page.title, &existing_slugs);
    let page_path = sec_dir.join(format!("{slug}.{PAGE_EXTENSION}"));
    atomic_write_json(&page_path, &page)?;
    Ok(page)
}
```

### Padrão IPC existente (src-tauri/src/commands/page.rs)

```rust
#[tauri::command]
pub fn create_page(
    state: State<AppManagedState>,
    section_id: SectionId,
    title: String,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    let page = FsStorageEngine::create_page(&root, section_id, &title).map_err(CommandError::from)?;
    try_index_page(&state, &root, &page);
    Ok(page)
}
```

---

## Tarefas

### 1.1 — Adicionar `TemplateId` em `crates/core/src/id.rs`

**Arquivo:** `crates/core/src/id.rs`

```rust
define_id!(TemplateId);
```

**Critérios:**
- [ ] Compila sem warnings
- [ ] Binding `TemplateId.ts` gerado em `src/types/bindings/`

---

### 1.2 — Criar `NoteTemplate` em `crates/core/src/template.rs`

**Arquivo:** `crates/core/src/template.rs` (novo)

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::block::Block;
use crate::error::CoreError;
use crate::id::TemplateId;
use crate::page::EditorPreferences;

pub const CURRENT_TEMPLATE_SCHEMA_VERSION: u32 = 1;
pub const TEMPLATE_NAME_MAX_LEN: usize = 100;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
#[serde(rename_all = "snake_case")]
pub enum TemplateCategory {
    Meeting,
    Journal,
    Project,
    Study,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct NoteTemplate {
    pub id: TemplateId,
    pub name: String,
    pub description: Option<String>,
    pub category: TemplateCategory,
    pub icon: Option<String>,
    /// Título sugerido ao criar page. Suporta placeholder {{date}}.
    pub title_template: String,
    pub tags: Vec<String>,
    pub blocks: Vec<Block>,
    pub editor_preferences: EditorPreferences,
    pub is_builtin: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub schema_version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct TemplateSummary {
    pub id: TemplateId,
    pub name: String,
    pub description: Option<String>,
    pub category: TemplateCategory,
    pub icon: Option<String>,
    pub title_template: String,
    pub is_builtin: bool,
    pub block_count: usize,
    pub created_at: DateTime<Utc>,
}

impl From<&NoteTemplate> for TemplateSummary {
    fn from(t: &NoteTemplate) -> Self {
        Self {
            id: t.id,
            name: t.name.clone(),
            description: t.description.clone(),
            category: t.category.clone(),
            icon: t.icon.clone(),
            title_template: t.title_template.clone(),
            is_builtin: t.is_builtin,
            block_count: t.blocks.len(),
            created_at: t.created_at,
        }
    }
}

impl NoteTemplate {
    pub fn new(
        name: &str,
        category: TemplateCategory,
        title_template: &str,
    ) -> Result<Self, CoreError> {
        let name = name.trim().to_string();
        if name.is_empty() {
            return Err(CoreError::Validation {
                message: "Template name cannot be empty".to_string(),
            });
        }
        if name.len() > TEMPLATE_NAME_MAX_LEN {
            return Err(CoreError::Validation {
                message: format!("Template name exceeds {TEMPLATE_NAME_MAX_LEN} characters"),
            });
        }
        let title_template = title_template.trim().to_string();
        if title_template.is_empty() {
            return Err(CoreError::Validation {
                message: "Template title_template cannot be empty".to_string(),
            });
        }
        let now = Utc::now();
        Ok(Self {
            id: TemplateId::new(),
            name,
            description: None,
            category,
            icon: None,
            title_template,
            tags: vec![],
            blocks: vec![],
            editor_preferences: EditorPreferences::default(),
            is_builtin: false,
            created_at: now,
            updated_at: now,
            schema_version: CURRENT_TEMPLATE_SCHEMA_VERSION,
        })
    }

    /// Resolve placeholders no título: {{date}} → data atual em formato ISO (YYYY-MM-DD).
    pub fn resolve_title(&self) -> String {
        let today = Utc::now().format("%Y-%m-%d").to_string();
        self.title_template.replace("{{date}}", &today)
    }

    /// Valida que nenhum bloco é do tipo ImageBlock (restrição v1).
    pub fn validate_no_image_blocks(&self) -> Result<(), CoreError> {
        for block in &self.blocks {
            if matches!(block, crate::block::Block::Image(_)) {
                return Err(CoreError::Validation {
                    message: "Templates with ImageBlock are not supported in v1. \
                              Remove image blocks before saving as template."
                        .to_string(),
                });
            }
        }
        Ok(())
    }
}
```

**Critérios:**
- [ ] `NoteTemplate` e `TemplateSummary` compilam com `#[derive(TS)]`
- [ ] `resolve_title()` substitui `{{date}}` corretamente
- [ ] `validate_no_image_blocks()` rejeita `ImageBlock` com `CoreError::Validation`
- [ ] Testes cobrindo: criação válida, nome vazio, nome longo, resolve_title com e sem placeholder, validação de blocos de imagem

---

### 1.3 — Expor módulo em `crates/core/src/lib.rs`

**Arquivo:** `crates/core/src/lib.rs`

```rust
pub mod template;
```

**Critérios:**
- [ ] `use opennote_core::template::NoteTemplate;` funciona de fora do crate

---

### 1.4 — Storage: CRUD de templates em `crates/storage/src/engine.rs`

**Arquivo:** `crates/storage/src/engine.rs`

Constantes a adicionar:
```rust
const TEMPLATES_DIR: &str = ".templates";
const TEMPLATE_EXTENSION: &str = "tpl.json";
```

Métodos a adicionar ao `impl FsStorageEngine`:
```rust
// Garante que o diretório .templates/ existe
fn templates_dir(workspace_root: &Path) -> PathBuf {
    workspace_root.join(TEMPLATES_DIR)
}

pub fn list_templates(workspace_root: &Path) -> StorageResult<Vec<TemplateSummary>> {
    let dir = Self::templates_dir(workspace_root);
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut summaries = Vec::new();
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() && path_has_extension(&path, TEMPLATE_EXTENSION) {
            let template: NoteTemplate = read_json(&path)?;
            summaries.push(TemplateSummary::from(&template));
        }
    }
    summaries.sort_by(|a, b| a.created_at.cmp(&b.created_at).reverse());
    Ok(summaries)
}

pub fn load_template(workspace_root: &Path, template_id: TemplateId) -> StorageResult<NoteTemplate> {
    let dir = Self::templates_dir(workspace_root);
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() && path_has_extension(&path, TEMPLATE_EXTENSION) {
            let t: NoteTemplate = read_json(&path)?;
            if t.id == template_id {
                return Ok(t);
            }
        }
    }
    Err(StorageError::TemplateNotFound { id: template_id.to_string() })
}

pub fn save_template(workspace_root: &Path, template: &NoteTemplate) -> StorageResult<NoteTemplate> {
    let dir = Self::templates_dir(workspace_root);
    fs::create_dir_all(&dir)?;
    let existing_slugs: HashSet<String> = fs::read_dir(&dir)?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let p = e.path();
            if path_has_extension(&p, TEMPLATE_EXTENSION) {
                p.file_stem().map(|s| s.to_string_lossy().to_string())
            } else {
                None
            }
        })
        .collect();
    let slug = unique_slug(&template.name, &existing_slugs);
    let path = dir.join(format!("{slug}.{TEMPLATE_EXTENSION}"));
    atomic_write_json(&path, template)?;
    Ok(template.clone())
}

pub fn delete_template(workspace_root: &Path, template_id: TemplateId) -> StorageResult<()> {
    let dir = Self::templates_dir(workspace_root);
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() && path_has_extension(&path, TEMPLATE_EXTENSION) {
            let t: NoteTemplate = read_json(&path)?;
            if t.id == template_id {
                fs::remove_file(&path)?;
                return Ok(());
            }
        }
    }
    Err(StorageError::TemplateNotFound { id: template_id.to_string() })
}
```

**Adicionar variante em `crates/storage/src/error.rs`:**
```rust
#[error("Template not found: {id}")]
TemplateNotFound { id: String },
```

**Critérios:**
- [ ] `list_templates` retorna vazio se `.templates/` não existir
- [ ] `save_template` cria o diretório se não existir
- [ ] `delete_template` retorna `TemplateNotFound` para ID inexistente
- [ ] Testes de integração com filesystem real em `crates/storage/tests/`

---

### 1.5 — IPC commands em `src-tauri/src/commands/template.rs`

**Arquivo:** `src-tauri/src/commands/template.rs` (novo)

```rust
use tauri::State;
use opennote_core::id::{PageId, SectionId, TemplateId};
use opennote_core::template::{NoteTemplate, TemplateSummary, TemplateCategory};
use opennote_core::page::{Page, PageId as _};
use opennote_storage::engine::FsStorageEngine;

use crate::error::CommandError;
use crate::state::AppManagedState;
use super::resolve_workspace_id;

fn resolve_root(state: &AppManagedState, workspace_id: Option<String>) -> Result<std::path::PathBuf, CommandError> {
    let id = resolve_workspace_id(state, workspace_id)?;
    state.get_workspace_root_by_id(&id)
}

/// Lista templates do usuário (do workspace). Templates embutidos são retornados pelo frontend
/// a partir dos dados estáticos definidos em TypeScript (Fase 2).
#[tauri::command]
pub fn list_templates(
    state: State<AppManagedState>,
    workspace_id: Option<String>,
) -> Result<Vec<TemplateSummary>, CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    FsStorageEngine::list_templates(&root).map_err(CommandError::from)
}

/// Salva uma página existente como template.
/// Rejeita páginas com ImageBlock (restrição v1) e páginas protegidas.
#[tauri::command]
pub fn create_template_from_page(
    state: State<AppManagedState>,
    page_id: PageId,
    name: String,
    description: Option<String>,
    category: TemplateCategory,
    workspace_id: Option<String>,
) -> Result<TemplateSummary, CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    let page = FsStorageEngine::load_page(&root, page_id).map_err(CommandError::from)?;

    if page.protection.is_some() {
        return Err(CommandError::Validation(
            "Cannot create template from a protected page".to_string(),
        ));
    }

    let mut template = NoteTemplate::new(&name, category, &page.title)
        .map_err(|e| CommandError::Validation(e.to_string()))?;

    template.description = description;
    template.tags = page.tags.clone();
    template.blocks = page.blocks.clone();
    template.editor_preferences = page.editor_preferences.clone();

    template
        .validate_no_image_blocks()
        .map_err(|e| CommandError::Validation(e.to_string()))?;

    let saved = FsStorageEngine::save_template(&root, &template).map_err(CommandError::from)?;
    Ok(TemplateSummary::from(&saved))
}

/// Deleta um template de usuário. Retorna erro se o ID não existir ou for de template embutido.
#[tauri::command]
pub fn delete_template(
    state: State<AppManagedState>,
    template_id: TemplateId,
    workspace_id: Option<String>,
) -> Result<(), CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    FsStorageEngine::delete_template(&root, template_id).map_err(CommandError::from)
}

/// Cria uma nova page a partir de um template de usuário (persiste no workspace).
/// Para templates embutidos, o frontend monta os blocks e chama `create_page` diretamente.
#[tauri::command]
pub fn create_page_from_template(
    state: State<AppManagedState>,
    section_id: SectionId,
    template_id: TemplateId,
    custom_title: Option<String>,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    let template = FsStorageEngine::load_template(&root, template_id).map_err(CommandError::from)?;

    let title = custom_title
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .unwrap_or_else(|| template.resolve_title());

    let mut page = Page::new(section_id, &title)
        .map_err(|e| CommandError::Validation(e.to_string()))?;

    page.tags = template.tags.clone();
    page.blocks = template.blocks.clone();
    page.editor_preferences = template.editor_preferences.clone();
    page.reorder_blocks();

    let saved = FsStorageEngine::create_page_from(&root, section_id, page).map_err(CommandError::from)?;

    super::page::try_index_page(&state, &root, &saved);
    Ok(saved)
}
```

**Registrar em `src-tauri/src/commands/mod.rs`:**
```rust
pub mod template;
```

**Registrar handlers em `src-tauri/src/lib.rs`** (dentro do `invoke_handler![]`):
```rust
commands::template::list_templates,
commands::template::create_template_from_page,
commands::template::delete_template,
commands::template::create_page_from_template,
```

**Critérios:**
- [ ] `create_template_from_page` rejeita página protegida com `CommandError::Validation`
- [ ] `create_template_from_page` rejeita `ImageBlock` com `CommandError::Validation`
- [ ] `create_page_from_template` indexa a page criada no Tantivy
- [ ] Todos os 4 commands registrados no Tauri handler

---

### 1.6 — TypeScript bindings em `src/lib/ipc.ts`

**Arquivo:** `src/lib/ipc.ts`

```typescript
// ─── Templates ───

import type { TemplateId } from "@/types/bindings/TemplateId";
import type { TemplateSummary } from "@/types/bindings/TemplateSummary";
import type { TemplateCategory } from "@/types/bindings/TemplateCategory";

export const listTemplates = (workspaceId?: string) =>
  invoke<TemplateSummary[]>("list_templates", { workspaceId });

export const createTemplateFromPage = (
  pageId: PageId,
  name: string,
  description: string | null,
  category: TemplateCategory,
  workspaceId?: string,
) =>
  invoke<TemplateSummary>("create_template_from_page", {
    pageId,
    name,
    description,
    category,
    workspaceId,
  });

export const deleteTemplate = (templateId: TemplateId, workspaceId?: string) =>
  invoke<void>("delete_template", { templateId, workspaceId });

export const createPageFromTemplate = (
  sectionId: SectionId,
  templateId: TemplateId,
  customTitle: string | null,
  workspaceId?: string,
) =>
  invoke<Page>("create_page_from_template", {
    sectionId,
    templateId,
    customTitle,
    workspaceId,
  });
```

**Critérios:**
- [ ] `npm run typecheck` sem erros
- [ ] Bindings gerados (`TemplateId.ts`, `TemplateSummary.ts`, `NoteTemplate.ts`, `TemplateCategory.ts`) em `src/types/bindings/`

---

### 1.7 — Testes unitários Rust

**Arquivo:** `crates/core/src/template.rs` (seção `#[cfg(test)]`)

| Teste | Descrição |
|-------|-----------|
| `create_template_valid` | Cria template com nome e título válidos |
| `reject_empty_name` | `CoreError::Validation` para nome vazio |
| `reject_name_too_long` | `CoreError::Validation` para nome > 100 chars |
| `reject_empty_title_template` | `CoreError::Validation` para título vazio |
| `resolve_title_with_date` | `{{date}}` substituído por data no formato `YYYY-MM-DD` |
| `resolve_title_without_placeholder` | Título sem `{{date}}` retorna inalterado |
| `validate_no_image_blocks_passes` | Template sem ImageBlock passa |
| `validate_no_image_blocks_fails` | Template com ImageBlock retorna `CoreError::Validation` |
| `template_summary_from_template` | `TemplateSummary::from` mapeia campos corretamente |

**Arquivo:** `crates/storage/tests/template_storage.rs` (novo)

| Teste | Descrição |
|-------|-----------|
| `list_templates_empty_when_no_dir` | Retorna `[]` se `.templates/` não existe |
| `save_and_list_template` | Salva e lista template de usuário |
| `load_template_by_id` | Carrega template pelo ID |
| `delete_template_removes_file` | Arquivo `.tpl.json` removido do disco |
| `delete_nonexistent_returns_error` | `StorageError::TemplateNotFound` |

**Critérios:**
- [ ] `cargo test -p opennote-core` passa
- [ ] `cargo test -p opennote-storage` passa
- [ ] Coverage ≥ 90% nas funções novas

---

## Arquivos Modificados

| Arquivo | Tipo de Mudança |
|---------|----------------|
| `crates/core/src/id.rs` | Alteração — adicionar `TemplateId` |
| `crates/core/src/lib.rs` | Alteração — expor `pub mod template` |
| `crates/core/src/template.rs` | **Novo** |
| `crates/storage/src/engine.rs` | Alteração — CRUD de templates |
| `crates/storage/src/error.rs` | Alteração — variante `TemplateNotFound` |
| `crates/storage/tests/template_storage.rs` | **Novo** |
| `src-tauri/src/commands/template.rs` | **Novo** |
| `src-tauri/src/commands/mod.rs` | Alteração — `pub mod template` |
| `src-tauri/src/lib.rs` | Alteração — registrar 4 handlers |
| `src/lib/ipc.ts` | Alteração — 4 wrappers TypeScript |
| `src/types/bindings/` | Gerado automaticamente por `ts-rs` |

## Arquivos NÃO Modificados (ainda)

- `src/components/` — sem UI nesta fase
- `src/locales/` — sem i18n nesta fase
- `src/stores/` — sem Zustand store nesta fase
- `crates/search/` — templates não são indexados no Tantivy

---

## Critérios de Aceitação da Fase

- [ ] `cargo test --workspace` passa
- [ ] `cargo clippy --workspace -- -D warnings` sem warnings
- [ ] `npm run typecheck` sem erros
- [ ] `git diff --exit-code src/types/bindings/` — bindings atualizados e commitados
- [ ] Nenhuma breaking change em APIs públicas existentes
- [ ] PR review aprovado

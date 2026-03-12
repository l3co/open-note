use opennote_core::id::{PageId, SectionId, TemplateId};
use opennote_core::page::Page;
use opennote_core::template::{NoteTemplate, TemplateCategory, TemplateSummary};
use opennote_storage::engine::FsStorageEngine;
use tauri::State;

use super::resolve_workspace_id;
use crate::error::CommandError;
use crate::state::AppManagedState;

fn resolve_root(
    state: &AppManagedState,
    workspace_id: Option<String>,
) -> Result<std::path::PathBuf, CommandError> {
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
        .map_err(|e: opennote_core::error::CoreError| CommandError::Validation(e.to_string()))?;

    template.description = description;
    template.tags = page.tags.clone();
    template.blocks = page.blocks.clone();
    template.editor_preferences = page.editor_preferences.clone();

    template
        .validate_no_image_blocks()
        .map_err(|e: opennote_core::error::CoreError| CommandError::Validation(e.to_string()))?;

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
    let template =
        FsStorageEngine::load_template(&root, template_id).map_err(CommandError::from)?;

    let title = custom_title
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .unwrap_or_else(|| template.resolve_title());

    let mut page = Page::new(section_id, &title)
        .map_err(|e: opennote_core::error::CoreError| CommandError::Validation(e.to_string()))?;

    page.tags = template.tags.clone();
    page.blocks = template.blocks.clone();
    page.editor_preferences = template.editor_preferences.clone();
    page.reorder_blocks();

    let saved =
        FsStorageEngine::create_page_from(&root, section_id, page).map_err(CommandError::from)?;

    super::page::try_index_page(&state, &root, &saved);

    Ok(saved)
}

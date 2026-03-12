use log::warn;
use tauri::State;

use opennote_core::annotation::PageAnnotations;
use opennote_core::block::Block;
use opennote_core::id::{PageId, SectionId};
use opennote_core::page::{Page, PageProtection, PageSummary, PROTECTED_TITLE_PLACEHOLDER};
use opennote_search::engine::PageIndexData;
use opennote_storage::encryption::{EncryptedPayload, EncryptionService};
use opennote_storage::engine::FsStorageEngine;

use crate::error::CommandError;
use crate::state::AppManagedState;

/// Descriptografa o payload completo da page em memória.
/// Restaura título real, tags, blocks e annotations.
fn decrypt_page_content(
    mut page: Page,
    protection: PageProtection,
    ciphertext: &str,
    key: &[u8],
) -> Result<Page, CommandError> {
    let plaintext = EncryptionService::decrypt(ciphertext, key, &protection)
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    let payload: EncryptedPayload =
        serde_json::from_slice(&plaintext).map_err(|e| CommandError::Storage(e.to_string()))?;

    page.title = payload.title; // TÍTULO REAL restaurado em memória
    page.tags = payload.tags; // TAGS reais restauradas em memória
    page.blocks = payload.blocks;
    page.annotations = payload.annotations;
    Ok(page)
}

/// Helper para criptografar o conteúdo sensível de uma página antes de salvar no disco.
/// Retorna a página "bloqueada" (para disco) e mantém a original intacta.
fn prepare_page_for_disk(
    page: &Page,
    key: &[u8],
    protection: &PageProtection,
) -> Result<Page, CommandError> {
    let payload = EncryptedPayload {
        title: page.title.clone(),
        tags: page.tags.clone(),
        blocks: page.blocks.clone(),
        annotations: page.annotations.clone(),
    };
    let plaintext =
        serde_json::to_vec(&payload).map_err(|e| CommandError::Storage(e.to_string()))?;

    // Gera novo nonce para cada escrita (segurança AES-GCM)
    let mut new_nonce = [0u8; 12];
    use rand::RngCore;
    rand::rngs::OsRng.fill_bytes(&mut new_nonce);
    use base64::{engine::general_purpose::STANDARD as B64, Engine};

    let new_protection = PageProtection {
        nonce: B64.encode(new_nonce),
        ..protection.clone()
    };

    let ciphertext = EncryptionService::encrypt(&plaintext, key, &new_protection)
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    let mut disk_page = page.clone();
    disk_page.title = PROTECTED_TITLE_PLACEHOLDER.to_string();
    disk_page.tags = vec![];
    disk_page.blocks = vec![];
    disk_page.annotations = PageAnnotations::default();
    disk_page.protection = Some(new_protection);
    disk_page.encrypted_content = Some(ciphertext);

    Ok(disk_page)
}

pub(crate) fn try_index_page(state: &AppManagedState, root: &std::path::Path, page: &Page) {
    if let Err(error) = state.ensure_search_engine() {
        warn!("Search engine is unavailable for page indexing: {}", error);
        return;
    }

    match super::search::resolve_page_context(root, page.section_id) {
        Ok(context) => {
            let data = PageIndexData {
                page: page.clone(),
                notebook_name: context.notebook_name,
                section_name: context.section_name,
                notebook_id: context.notebook_id,
                section_id: context.section_id,
            };

            if let Err(error) = state
                .with_search_engine(|engine| engine.index_page(&data).map_err(CommandError::from))
            {
                warn!("Failed to index page {}: {}", page.id, error);
            }
        }
        Err(error) => {
            warn!("Could not resolve page context for indexing: {}", error);
        }
    }
}

/// Resolve o workspace_id e obtém o root_path, propagando erros.
fn resolve_root(
    state: &AppManagedState,
    workspace_id: Option<String>,
) -> Result<std::path::PathBuf, CommandError> {
    let id = super::resolve_workspace_id(state, workspace_id)?;
    state.get_workspace_root_by_id(&id)
}

#[tauri::command]
pub fn list_pages(
    state: State<AppManagedState>,
    section_id: SectionId,
    workspace_id: Option<String>,
) -> Result<Vec<PageSummary>, CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    FsStorageEngine::list_pages(&root, section_id).map_err(CommandError::from)
}

#[tauri::command]
pub fn load_page(
    state: State<AppManagedState>,
    page_id: PageId,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    load_page_internal(&state, page_id, workspace_id)
}

pub(crate) fn load_page_internal(
    state: &AppManagedState,
    page_id: PageId,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    let root = resolve_root(state, workspace_id)?;
    let mut page = FsStorageEngine::load_page(&root, page_id).map_err(CommandError::from)?;

    // Se a page está protegida e já foi desbloqueada nesta sessão, descriptografa em memória
    if let (Some(protection), Some(ciphertext)) = (&page.protection, &page.encrypted_content) {
        if let Some(key) = state.get_cached_key(page_id)? {
            return decrypt_page_content(page.clone(), protection.clone(), ciphertext, &key);
        }
        // NÃO DESBLOQUEADA: Garantir que blocos e título sensíveis não vazem, mesmo que o arquivo no disco esteja sujo
        page.title = PROTECTED_TITLE_PLACEHOLDER.to_string();
        page.blocks = vec![];
        page.tags = vec![];
        page.annotations = PageAnnotations::default();
        return Ok(page);
    }

    Ok(page)
}

/// Desbloqueia uma page protegida. Deriva a chave, valida descriptografando,
/// armazena a chave na sessão e retorna a page com conteúdo completo.
#[tauri::command]
pub fn unlock_page(
    state: State<AppManagedState>,
    page_id: PageId,
    password: String,
    duration_mins: Option<u32>,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    unlock_page_internal(&state, page_id, password, duration_mins, workspace_id)
}

pub(crate) fn unlock_page_internal(
    state: &AppManagedState,
    page_id: PageId,
    password: String,
    duration_mins: Option<u32>,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    let root = resolve_root(state, workspace_id)?;
    let page = FsStorageEngine::load_page(&root, page_id).map_err(CommandError::from)?;

    let (protection, ciphertext) = match (&page.protection, &page.encrypted_content) {
        (Some(p), Some(c)) => (p.clone(), c.clone()),
        _ => {
            return Err(CommandError::Validation(
                "Page is not protected".to_string(),
            ))
        }
    };

    let key = EncryptionService::derive_key(&password, &protection)
        .map_err(|e| CommandError::Storage(e.to_string()))?;

    // Tentar descriptografar valida a senha (AES-GCM autentica)
    let decrypted_page = decrypt_page_content(page, protection, &ciphertext, &key)
        .map_err(|_| CommandError::Validation("WRONG_PASSWORD".to_string()))?;

    // Senha correta — calcular expiração se fornecida
    let expires_at =
        duration_mins.map(|m| chrono::Utc::now() + chrono::Duration::minutes(m as i64));

    // Armazenar chave na sessão com expiração
    state.cache_key(page_id, key, expires_at)?;

    Ok(decrypted_page)
}

/// Protege uma page com senha. Criptografa título, tags, blocks e annotations e salva em disco.
#[tauri::command]
pub async fn set_page_password(
    state: State<'_, AppManagedState>,
    page_id: PageId,
    password: String,
    workspace_id: Option<String>,
) -> Result<(), CommandError> {
    set_page_password_internal(&state, page_id, password, workspace_id)
}

pub(crate) fn set_page_password_internal(
    state: &AppManagedState,
    page_id: PageId,
    password: String,
    workspace_id: Option<String>,
) -> Result<(), CommandError> {
    EncryptionService::validate_password(&password)
        .map_err(|e| CommandError::Storage(e.to_string()))?;
    let root = resolve_root(state, workspace_id)?;

    let (key_out, page_out) = state.save_coordinator.with_page_lock(page_id, || {
        let mut page = FsStorageEngine::load_page(&root, page_id).map_err(CommandError::from)?;

        if page.protection.is_some() {
            return Err(CommandError::Validation(
                "Page is already protected. Use change_page_password.".into(),
            ));
        }

        let protection = EncryptionService::new_protection()
            .map_err(|e| CommandError::Storage(e.to_string()))?;
        let key = EncryptionService::derive_key(&password, &protection)
            .map_err(|e| CommandError::Storage(e.to_string()))?;

        // Payload inclui TÍTULO REAL e TAGS
        let payload = EncryptedPayload {
            title: page.title.clone(),
            tags: page.tags.clone(),
            blocks: page.blocks.clone(),
            annotations: page.annotations.clone(),
        };
        let plaintext =
            serde_json::to_vec(&payload).map_err(|e| CommandError::Storage(e.to_string()))?;
        let ciphertext = EncryptionService::encrypt(&plaintext, &key, &protection)
            .map_err(|e| CommandError::Storage(e.to_string()))?;

        // No disco: título vira placeholder, tags e blocks ficam vazios
        page.title = PROTECTED_TITLE_PLACEHOLDER.to_string();
        page.tags = vec![];
        page.blocks = vec![];
        page.annotations = PageAnnotations::default();
        page.protection = Some(protection);
        page.encrypted_content = Some(ciphertext);
        page.updated_at = chrono::Utc::now();

        FsStorageEngine::update_page(&root, &page).map_err(CommandError::from)?;
        Ok((key, page))
    })?;

    // Cacheia a chave — usuário não precisa fazer unlock após definir a senha.
    let expires_at = Some(chrono::Utc::now() + chrono::Duration::minutes(30));
    state.cache_key(page_id, key_out, expires_at)?;

    // Reindexa para remover do índice de busca (agora protegida)
    try_index_page(state, &root, &page_out);

    Ok(())
}

/// Remove a proteção por senha de uma page. Requer a senha atual.
#[tauri::command]
pub async fn remove_page_password(
    state: State<'_, AppManagedState>,
    page_id: PageId,
    password: String,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    remove_page_password_internal(&state, page_id, password, workspace_id)
}

pub(crate) fn remove_page_password_internal(
    state: &AppManagedState,
    page_id: PageId,
    password: String,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    let root = resolve_root(state, workspace_id)?;

    let page = state.save_coordinator.with_page_lock(page_id, || {
        let mut page = FsStorageEngine::load_page(&root, page_id).map_err(CommandError::from)?;

        let (protection, ciphertext) = match (&page.protection, &page.encrypted_content) {
            (Some(p), Some(c)) => (p.clone(), c.clone()),
            _ => {
                return Err(CommandError::Validation(
                    "Page is not protected".to_string(),
                ))
            }
        };

        let key = EncryptionService::derive_key(&password, &protection)
            .map_err(|e| CommandError::Storage(e.to_string()))?;
        let plaintext = EncryptionService::decrypt(&ciphertext, &key, &protection)
            .map_err(|_| CommandError::Validation("WRONG_PASSWORD".to_string()))?;

        let payload: EncryptedPayload =
            serde_json::from_slice(&plaintext).map_err(|e| CommandError::Storage(e.to_string()))?;

        // Restaura todos os campos plaintext
        page.title = payload.title;
        page.tags = payload.tags;
        page.blocks = payload.blocks;
        page.annotations = payload.annotations;
        page.protection = None;
        page.encrypted_content = None;
        page.updated_at = chrono::Utc::now();

        FsStorageEngine::update_page(&root, &page).map_err(CommandError::from)?;
        Ok(page)
    })?;

    // Chave evictada do session cache após remoção de proteção
    state.evict_key(page_id)?;

    // Reindexa para restaurar título e conteúdo no índice
    try_index_page(state, &root, &page);

    Ok(page)
}

/// Troca a senha de uma page protegida.
/// Requer senha atual para descriptografar; re-criptografa com nova senha e novos salt/nonce.
#[tauri::command]
pub async fn change_page_password(
    state: State<'_, AppManagedState>,
    page_id: PageId,
    old_password: String,
    new_password: String,
    workspace_id: Option<String>,
) -> Result<(), CommandError> {
    change_page_password_internal(&state, page_id, old_password, new_password, workspace_id)
}

pub(crate) fn change_page_password_internal(
    state: &AppManagedState,
    page_id: PageId,
    old_password: String,
    new_password: String,
    workspace_id: Option<String>,
) -> Result<(), CommandError> {
    EncryptionService::validate_password(&new_password)
        .map_err(|e| CommandError::Storage(e.to_string()))?;
    let root = resolve_root(state, workspace_id)?;

    state.save_coordinator.with_page_lock(page_id, || {
        let mut page = FsStorageEngine::load_page(&root, page_id).map_err(CommandError::from)?;

        let (old_protection, ciphertext) = match (&page.protection, &page.encrypted_content) {
            (Some(p), Some(c)) => (p.clone(), c.clone()),
            _ => {
                return Err(CommandError::Validation(
                    "Page is not protected".to_string(),
                ))
            }
        };

        let old_key = EncryptionService::derive_key(&old_password, &old_protection)
            .map_err(|e| CommandError::Storage(e.to_string()))?;
        let plaintext = EncryptionService::decrypt(&ciphertext, &old_key, &old_protection)
            .map_err(|_| CommandError::Validation("WRONG_PASSWORD".to_string()))?;

        // Re-criptografa com novos salt + nonce (rotação de chave)
        let new_protection = EncryptionService::new_protection()
            .map_err(|e| CommandError::Storage(e.to_string()))?;
        let new_key = EncryptionService::derive_key(&new_password, &new_protection)
            .map_err(|e| CommandError::Storage(e.to_string()))?;
        let new_ciphertext = EncryptionService::encrypt(&plaintext, &new_key, &new_protection)
            .map_err(|e| CommandError::Storage(e.to_string()))?;

        page.protection = Some(new_protection);
        page.encrypted_content = Some(new_ciphertext);
        page.updated_at = chrono::Utc::now();

        FsStorageEngine::update_page(&root, &page).map_err(CommandError::from)?;
        Ok(())
    })?;

    // Atualiza cache: remove chave antiga e deixa o próximo unlock/load re-cachear
    state.evict_key(page_id)?;
    Ok(())
}

/// Remove a chave da página do cache de sessão imediatamente.
#[tauri::command]
pub fn lock_page(state: State<AppManagedState>, page_id: PageId) -> Result<(), CommandError> {
    state.evict_key(page_id)?;
    Ok(())
}

#[tauri::command]
pub fn create_page(
    state: State<AppManagedState>,
    section_id: SectionId,
    title: String,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    create_page_internal(&state, section_id, title, workspace_id)
}

pub(crate) fn create_page_internal(
    state: &AppManagedState,
    section_id: SectionId,
    title: String,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    let root = resolve_root(state, workspace_id)?;
    let page =
        FsStorageEngine::create_page(&root, section_id, &title).map_err(CommandError::from)?;

    try_index_page(state, &root, &page);

    Ok(page)
}

#[tauri::command]
pub fn update_page(
    state: State<AppManagedState>,
    page: Page,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    update_page_internal(&state, page, workspace_id)
}

pub(crate) fn update_page_internal(
    state: &AppManagedState,
    mut page: Page,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    let root = resolve_root(state, workspace_id)?;
    let page_id = page.id;

    let result_page = state.save_coordinator.with_page_lock(page_id, || {
        let current_on_disk =
            FsStorageEngine::load_page(&root, page_id).map_err(CommandError::from)?;
        page.updated_at = chrono::Utc::now();

        if let Some(protection) = current_on_disk.protection.clone() {
            // Page protegida no disco: exige chave para salvar
            let key = state.get_cached_key(page_id)?.ok_or_else(|| {
                CommandError::Validation(
                    "Page is locked. Cannot save protected page without key.".into(),
                )
            })?;

            let disk_page = prepare_page_for_disk(&page, &key, &protection)?;
            FsStorageEngine::update_page(&root, &disk_page).map_err(CommandError::from)?;

            // Retorna a original (unlocked) para o front
            Ok(page)
        } else {
            // Page comum: salva normalmente
            FsStorageEngine::update_page(&root, &page).map_err(CommandError::from)?;
            Ok(page)
        }
    })?;

    try_index_page(state, &root, &result_page);
    Ok(result_page)
}

#[tauri::command]
pub fn update_page_blocks(
    state: State<AppManagedState>,
    page_id: PageId,
    blocks: Vec<Block>,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    update_page_blocks_internal(&state, page_id, blocks, workspace_id)
}

pub(crate) fn update_page_blocks_internal(
    state: &AppManagedState,
    page_id: PageId,
    blocks: Vec<Block>,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    let root = resolve_root(state, workspace_id)?;

    let result_page = state.save_coordinator.with_page_lock(page_id, || {
        let mut page = FsStorageEngine::load_page(&root, page_id).map_err(CommandError::from)?;
        page.updated_at = chrono::Utc::now();

        if let Some(protection) = page.protection.clone() {
            let key = state.get_cached_key(page_id)?.ok_or_else(|| {
                CommandError::Validation("Page is locked. Cannot save without unlock.".into())
            })?;

            // Pega o conteúdo real para atualizar apenas os blocos
            let old_ciphertext = page
                .encrypted_content
                .clone()
                .ok_or_else(|| CommandError::Storage("Missing encrypted_content".into()))?;
            let old_plaintext = EncryptionService::decrypt(&old_ciphertext, &key, &protection)
                .map_err(|e| CommandError::Storage(e.to_string()))?;
            let mut payload: EncryptedPayload = serde_json::from_slice(&old_plaintext)
                .map_err(|e| CommandError::Storage(e.to_string()))?;

            payload.blocks = blocks;

            // Prepara objeto page completo na memória (unlocked)
            let mut unlocked_page = page.clone();
            unlocked_page.title = payload.title.clone();
            unlocked_page.tags = payload.tags.clone();
            unlocked_page.blocks = payload.blocks.clone();
            unlocked_page.annotations = payload.annotations.clone();

            let disk_page = prepare_page_for_disk(&unlocked_page, &key, &protection)?;
            FsStorageEngine::update_page(&root, &disk_page).map_err(CommandError::from)?;

            Ok(unlocked_page)
        } else {
            page.blocks = blocks;
            FsStorageEngine::update_page(&root, &page).map_err(CommandError::from)?;
            Ok(page)
        }
    })?;

    try_index_page(state, &root, &result_page);
    Ok(result_page)
}

#[tauri::command]
pub fn delete_page(
    state: State<AppManagedState>,
    page_id: PageId,
    workspace_id: Option<String>,
) -> Result<(), CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    FsStorageEngine::delete_page(&root, page_id).map_err(CommandError::from)?;

    if let Err(error) = state.with_search_engine(|engine| {
        engine
            .remove_page(&page_id.to_string())
            .map_err(CommandError::from)
    }) {
        warn!("Failed to remove page {} from index: {}", page_id, error);
    }

    Ok(())
}

#[tauri::command]
pub fn move_page(
    state: State<AppManagedState>,
    page_id: PageId,
    target_section_id: SectionId,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    let page = FsStorageEngine::move_page(&root, page_id, target_section_id)
        .map_err(CommandError::from)?;

    try_index_page(&state, &root, &page);

    Ok(page)
}

#[tauri::command]
pub fn import_pdf(
    state: State<AppManagedState>,
    section_id: SectionId,
    file_path: String,
    workspace_id: Option<String>,
) -> Result<(String, String, u32), CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    let source = std::path::Path::new(&file_path);

    if !source.exists() {
        return Err(CommandError::NotFound("PDF file not found".to_string()));
    }

    let (_nb_dir, section_path) =
        FsStorageEngine::find_section_dir(&root, section_id).map_err(CommandError::from)?;
    let assets_dir = section_path.join("assets");
    std::fs::create_dir_all(&assets_dir)
        .map_err(|error| CommandError::Storage(format!("Failed to create assets dir: {error}")))?;

    let uuid = uuid::Uuid::new_v4();
    let dest_name = format!("{uuid}.pdf");
    let dest_path = assets_dir.join(&dest_name);
    std::fs::copy(source, &dest_path)
        .map_err(|error| CommandError::Storage(format!("Failed to copy PDF: {error}")))?;

    let asset_rel = format!("assets/{dest_name}");
    let absolute_path = dest_path.to_string_lossy().to_string();

    let page_count = count_pdf_pages(&dest_path).unwrap_or(0);

    Ok((asset_rel, absolute_path, page_count))
}

fn count_pdf_pages(path: &std::path::Path) -> Option<u32> {
    let document = lopdf::Document::load(path).ok()?;
    Some(document.get_pages().len() as u32)
}

#[tauri::command]
pub fn create_pdf_canvas_page(
    state: State<AppManagedState>,
    section_id: SectionId,
    title: String,
    pdf_asset: String,
    pdf_total_pages: u32,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    let page = Page::new_pdf_canvas(section_id, &title, &pdf_asset, pdf_total_pages)
        .map_err(CommandError::from)?;
    let page =
        FsStorageEngine::create_page_from(&root, section_id, page).map_err(CommandError::from)?;
    try_index_page(&state, &root, &page);
    Ok(page)
}

#[tauri::command]
pub fn update_page_annotations(
    state: State<AppManagedState>,
    page_id: PageId,
    annotations: PageAnnotations,
    workspace_id: Option<String>,
) -> Result<(), CommandError> {
    update_page_annotations_internal(&state, page_id, annotations, workspace_id)
}

pub(crate) fn update_page_annotations_internal(
    state: &AppManagedState,
    page_id: PageId,
    annotations: PageAnnotations,
    workspace_id: Option<String>,
) -> Result<(), CommandError> {
    let root = resolve_root(state, workspace_id)?;
    state.save_coordinator.with_page_lock(page_id, || {
        let mut page = FsStorageEngine::load_page(&root, page_id).map_err(CommandError::from)?;
        page.updated_at = chrono::Utc::now();

        if let Some(protection) = page.protection.clone() {
            let key = state.get_cached_key(page_id)?.ok_or_else(|| {
                CommandError::Validation("Page is locked. Cannot save without unlock.".into())
            })?;

            let old_ciphertext = page
                .encrypted_content
                .clone()
                .ok_or_else(|| CommandError::Storage("Missing encrypted_content".into()))?;
            let old_plaintext = EncryptionService::decrypt(&old_ciphertext, &key, &protection)
                .map_err(|e| CommandError::Storage(e.to_string()))?;
            let mut payload: EncryptedPayload = serde_json::from_slice(&old_plaintext)
                .map_err(|e| CommandError::Storage(e.to_string()))?;

            payload.annotations = annotations;

            let mut unlocked_page = page.clone();
            unlocked_page.title = payload.title;
            unlocked_page.tags = payload.tags;
            unlocked_page.blocks = payload.blocks;
            unlocked_page.annotations = payload.annotations;

            let disk_page = prepare_page_for_disk(&unlocked_page, &key, &protection)?;
            FsStorageEngine::update_page(&root, &disk_page).map_err(CommandError::from)?;
            Ok(())
        } else {
            page.annotations = annotations;
            FsStorageEngine::update_page(&root, &page).map_err(CommandError::from)?;
            Ok(())
        }
    })
}

#[tauri::command]
pub fn create_canvas_page(
    state: State<AppManagedState>,
    section_id: SectionId,
    title: String,
    workspace_id: Option<String>,
) -> Result<Page, CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    let page = Page::new_canvas(section_id, &title).map_err(CommandError::from)?;
    let page =
        FsStorageEngine::create_page_from(&root, section_id, page).map_err(CommandError::from)?;
    try_index_page(&state, &root, &page);
    Ok(page)
}

#[tauri::command]
pub fn update_page_canvas_state(
    state: State<AppManagedState>,
    page_id: PageId,
    canvas_state: Option<serde_json::Value>,
    workspace_id: Option<String>,
) -> Result<(), CommandError> {
    let root = resolve_root(&state, workspace_id)?;
    state.save_coordinator.with_page_lock(page_id, || {
        let mut page = FsStorageEngine::load_page(&root, page_id).map_err(CommandError::from)?;
        page.update_canvas_state(canvas_state);
        FsStorageEngine::update_page(&root, &page).map_err(CommandError::from)?;
        Ok(())
    })
}

#[tauri::command]
pub fn read_file_content(path: String) -> Result<String, CommandError> {
    std::fs::read_to_string(&path)
        .map_err(|error| CommandError::Storage(format!("Failed to read file: {error}")))
}

#[tauri::command]
pub fn save_file_content(path: String, content: String) -> Result<(), CommandError> {
    std::fs::write(&path, &content)
        .map_err(|error| CommandError::Storage(format!("Failed to write file: {error}")))
}

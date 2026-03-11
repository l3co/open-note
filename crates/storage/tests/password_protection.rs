use opennote_core::id::{PageId, SectionId};
use opennote_core::page::{Page, PROTECTED_TITLE_PLACEHOLDER};
use opennote_storage::encryption::{EncryptedPayload, EncryptionService};
use opennote_storage::engine::FsStorageEngine;
use tempfile::tempdir;

#[test]
fn test_storage_layer_protection_roundtrip() {
    let dir = tempdir().unwrap();
    let root = dir.path();

    // 1. Criar notebook e seção
    let notebook = FsStorageEngine::create_notebook(root, "Secret Notebook").unwrap();
    let section = FsStorageEngine::create_section(root, notebook.id, "Top Secret").unwrap();

    // 2. Criar página com conteúdo
    let mut page = Page::new(section.id, "Real Title").unwrap();
    page.blocks.push(opennote_core::block::Block::new_text(0, serde_json::json!({"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Confidential content"}]}]})));
    FsStorageEngine::create_page_from(root, section.id, page.clone()).unwrap();

    // 3. Proteger via serviço (simulando o que o command faria)
    let protection = EncryptionService::new_protection().unwrap();
    let key = EncryptionService::derive_key("password123", &protection).unwrap();

    let payload = EncryptedPayload {
        title: page.title.clone(),
        tags: page.tags.clone(),
        blocks: page.blocks.clone(),
        annotations: page.annotations.clone(),
    };
    let plaintext = serde_json::to_vec(&payload).unwrap();
    let ciphertext = EncryptionService::encrypt(&plaintext, &key, &protection).unwrap();

    page.title = PROTECTED_TITLE_PLACEHOLDER.to_string();
    page.blocks = vec![];
    page.protection = Some(protection);
    page.encrypted_content = Some(ciphertext);

    FsStorageEngine::update_page(root, &page).unwrap();

    // 4. Verificar arquivo no disco (blocks deve estar vazio)
    let loaded = FsStorageEngine::load_page(root, page.id).unwrap();
    assert_eq!(loaded.title, PROTECTED_TITLE_PLACEHOLDER);
    assert!(loaded.blocks.is_empty());
    assert!(loaded.protection.is_some());

    // 5. Descriptografar manualmente e validar conteúdo real
    let prot = loaded.protection.as_ref().unwrap();
    let key2 = EncryptionService::derive_key("password123", prot).unwrap();
    let decrypted =
        EncryptionService::decrypt(loaded.encrypted_content.as_ref().unwrap(), &key2, prot)
            .unwrap();
    let payload2: EncryptedPayload = serde_json::from_slice(&decrypted).unwrap();

    assert_eq!(payload2.title, "Real Title");
    assert_eq!(payload2.blocks.len(), 1);
}

#[test]
fn test_page_migration_preserves_content() {
    let dir = tempdir().unwrap();
    let root = dir.path();

    let notebook = FsStorageEngine::create_notebook(root, "NB").unwrap();
    let section = FsStorageEngine::create_section(root, notebook.id, "SEC").unwrap();

    let page_id = PageId::new();
    let section_id = section.id;

    // Escrever manualmente um JSON v1
    let v1_json = serde_json::json!({
        "schema_version": 1,
        "id": page_id,
        "section_id": section_id,
        "title": "Legacy Page",
        "tags": [],
        "blocks": [],
        "annotations": { "strokes": [], "highlights": [] },
        "editor_preferences": { "mode": "rich_text", "split_view": false },
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
    });

    let notebook_dir = root.join("Secret Notebook"); // Opa, usei o nome do teste acima? Não, notebook.name
                                                     // Melhor usar o path real gerado
    let (_, section_path) = FsStorageEngine::find_section_dir(root, section_id).unwrap();
    let page_path = section_path.join(format!("{}.opn.json", page_id));

    std::fs::write(&page_path, serde_json::to_string_pretty(&v1_json).unwrap()).unwrap();

    // load_page deve migrar automaticamente
    let loaded = FsStorageEngine::load_page(root, page_id).unwrap();
    assert_eq!(loaded.schema_version, 2);
    assert_eq!(loaded.title, "Legacy Page");
    assert!(loaded.protection.is_none());
}

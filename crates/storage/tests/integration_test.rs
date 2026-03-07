use tempfile::TempDir;

use opennote_storage::engine::FsStorageEngine;

fn setup_workspace() -> (TempDir, std::path::PathBuf) {
    let dir = TempDir::new().unwrap();
    let root = dir.path().to_path_buf();
    FsStorageEngine::create_workspace(&root, "Test Workspace").unwrap();
    (dir, root)
}

// ─── Workspace ───

#[test]
fn create_and_load_workspace() {
    let dir = TempDir::new().unwrap();
    let root = dir.path().to_path_buf();

    let ws = FsStorageEngine::create_workspace(&root, "My Notes").unwrap();
    assert_eq!(ws.name, "My Notes");
    assert!(root.join("workspace.json").exists());
    assert!(root.join(".trash").exists());

    let loaded = FsStorageEngine::load_workspace(&root).unwrap();
    assert_eq!(loaded.id, ws.id);
    assert_eq!(loaded.name, "My Notes");
}

#[test]
fn load_nonexistent_workspace_fails() {
    let dir = TempDir::new().unwrap();
    let result = FsStorageEngine::load_workspace(dir.path());
    assert!(result.is_err());
}

#[test]
fn open_and_close_workspace() {
    let (_dir, root) = setup_workspace();

    let ws = FsStorageEngine::open_workspace(&root).unwrap();
    assert_eq!(ws.name, "Test Workspace");
    assert!(root.join(".lock").exists());

    FsStorageEngine::close_workspace(&root).unwrap();
    assert!(!root.join(".lock").exists());
}

// ─── Notebook ───

#[test]
fn create_and_list_notebooks() {
    let (_dir, root) = setup_workspace();

    let nb1 = FsStorageEngine::create_notebook(&root, "Estudos").unwrap();
    let nb2 = FsStorageEngine::create_notebook(&root, "Trabalho").unwrap();

    let notebooks = FsStorageEngine::list_notebooks(&root).unwrap();
    assert_eq!(notebooks.len(), 2);
    assert_eq!(notebooks[0].id, nb1.id);
    assert_eq!(notebooks[1].id, nb2.id);
}

#[test]
fn rename_notebook() {
    let (_dir, root) = setup_workspace();
    let nb = FsStorageEngine::create_notebook(&root, "Old Name").unwrap();

    let renamed = FsStorageEngine::rename_notebook(&root, nb.id, "New Name").unwrap();
    assert_eq!(renamed.name, "New Name");

    let notebooks = FsStorageEngine::list_notebooks(&root).unwrap();
    assert_eq!(notebooks.len(), 1);
    assert_eq!(notebooks[0].name, "New Name");
}

#[test]
fn delete_notebook_moves_to_trash() {
    let (_dir, root) = setup_workspace();
    let nb = FsStorageEngine::create_notebook(&root, "To Delete").unwrap();

    FsStorageEngine::delete_notebook(&root, nb.id).unwrap();

    let notebooks = FsStorageEngine::list_notebooks(&root).unwrap();
    assert!(notebooks.is_empty());

    let trash = FsStorageEngine::list_trash_items(&root).unwrap();
    assert_eq!(trash.len(), 1);
    assert_eq!(trash[0].original_title, "To Delete");
}

#[test]
fn reorder_notebooks() {
    let (_dir, root) = setup_workspace();
    let nb1 = FsStorageEngine::create_notebook(&root, "First").unwrap();
    let nb2 = FsStorageEngine::create_notebook(&root, "Second").unwrap();

    FsStorageEngine::reorder_notebooks(&root, &[(nb2.id, 0), (nb1.id, 1)]).unwrap();

    let notebooks = FsStorageEngine::list_notebooks(&root).unwrap();
    assert_eq!(notebooks[0].name, "Second");
    assert_eq!(notebooks[1].name, "First");
}

// ─── Section ───

#[test]
fn create_and_list_sections() {
    let (_dir, root) = setup_workspace();
    let nb = FsStorageEngine::create_notebook(&root, "NB").unwrap();

    let sec1 = FsStorageEngine::create_section(&root, nb.id, "Aulas").unwrap();
    let sec2 = FsStorageEngine::create_section(&root, nb.id, "Projetos").unwrap();

    let sections = FsStorageEngine::list_sections(&root, nb.id).unwrap();
    assert_eq!(sections.len(), 2);
    assert_eq!(sections[0].id, sec1.id);
    assert_eq!(sections[1].id, sec2.id);
}

#[test]
fn rename_section() {
    let (_dir, root) = setup_workspace();
    let nb = FsStorageEngine::create_notebook(&root, "NB").unwrap();
    let sec = FsStorageEngine::create_section(&root, nb.id, "Old").unwrap();

    let renamed = FsStorageEngine::rename_section(&root, sec.id, "New").unwrap();
    assert_eq!(renamed.name, "New");
}

#[test]
fn delete_section_moves_to_trash() {
    let (_dir, root) = setup_workspace();
    let nb = FsStorageEngine::create_notebook(&root, "NB").unwrap();
    let sec = FsStorageEngine::create_section(&root, nb.id, "To Delete").unwrap();

    FsStorageEngine::delete_section(&root, sec.id).unwrap();

    let sections = FsStorageEngine::list_sections(&root, nb.id).unwrap();
    assert!(sections.is_empty());

    let trash = FsStorageEngine::list_trash_items(&root).unwrap();
    assert_eq!(trash.len(), 1);
}

// ─── Page ───

#[test]
fn create_and_list_pages() {
    let (_dir, root) = setup_workspace();
    let nb = FsStorageEngine::create_notebook(&root, "NB").unwrap();
    let sec = FsStorageEngine::create_section(&root, nb.id, "Sec").unwrap();

    let p1 = FsStorageEngine::create_page(&root, sec.id, "Page 1").unwrap();
    let p2 = FsStorageEngine::create_page(&root, sec.id, "Page 2").unwrap();

    let pages = FsStorageEngine::list_pages(&root, sec.id).unwrap();
    assert_eq!(pages.len(), 2);

    let ids: Vec<_> = pages.iter().map(|p| p.id).collect();
    assert!(ids.contains(&p1.id));
    assert!(ids.contains(&p2.id));
}

#[test]
fn load_and_update_page() {
    let (_dir, root) = setup_workspace();
    let nb = FsStorageEngine::create_notebook(&root, "NB").unwrap();
    let sec = FsStorageEngine::create_section(&root, nb.id, "Sec").unwrap();
    let page = FsStorageEngine::create_page(&root, sec.id, "My Page").unwrap();

    let mut loaded = FsStorageEngine::load_page(&root, page.id).unwrap();
    assert_eq!(loaded.title, "My Page");

    loaded.add_tag("test");
    loaded
        .add_block(opennote_core::block::Block::new_divider(0))
        .unwrap();
    FsStorageEngine::update_page(&root, &loaded).unwrap();

    let reloaded = FsStorageEngine::load_page(&root, page.id).unwrap();
    assert_eq!(reloaded.tags, vec!["test"]);
    assert_eq!(reloaded.block_count(), 1);
}

#[test]
fn delete_page_moves_to_trash() {
    let (_dir, root) = setup_workspace();
    let nb = FsStorageEngine::create_notebook(&root, "NB").unwrap();
    let sec = FsStorageEngine::create_section(&root, nb.id, "Sec").unwrap();
    let page = FsStorageEngine::create_page(&root, sec.id, "To Delete").unwrap();

    FsStorageEngine::delete_page(&root, page.id).unwrap();

    let pages = FsStorageEngine::list_pages(&root, sec.id).unwrap();
    assert!(pages.is_empty());

    let trash = FsStorageEngine::list_trash_items(&root).unwrap();
    assert_eq!(trash.len(), 1);
    assert_eq!(trash[0].original_title, "To Delete");
}

#[test]
fn move_page_between_sections() {
    let (_dir, root) = setup_workspace();
    let nb = FsStorageEngine::create_notebook(&root, "NB").unwrap();
    let sec1 = FsStorageEngine::create_section(&root, nb.id, "Sec 1").unwrap();
    let sec2 = FsStorageEngine::create_section(&root, nb.id, "Sec 2").unwrap();

    let page = FsStorageEngine::create_page(&root, sec1.id, "Movable").unwrap();
    let moved = FsStorageEngine::move_page(&root, page.id, sec2.id).unwrap();

    assert_eq!(moved.section_id, sec2.id);

    let pages_sec1 = FsStorageEngine::list_pages(&root, sec1.id).unwrap();
    let pages_sec2 = FsStorageEngine::list_pages(&root, sec2.id).unwrap();
    assert!(pages_sec1.is_empty());
    assert_eq!(pages_sec2.len(), 1);
}

// ─── Assets ───

#[test]
fn import_asset_from_bytes() {
    let (_dir, root) = setup_workspace();
    let nb = FsStorageEngine::create_notebook(&root, "NB").unwrap();
    let sec = FsStorageEngine::create_section(&root, nb.id, "Sec").unwrap();

    let asset_path =
        FsStorageEngine::import_asset_from_bytes(&root, sec.id, b"fake image data", "png").unwrap();

    assert!(asset_path.ends_with(".png"));
    assert!(root.join(&asset_path).exists());
}

#[test]
fn delete_asset() {
    let (_dir, root) = setup_workspace();
    let nb = FsStorageEngine::create_notebook(&root, "NB").unwrap();
    let sec = FsStorageEngine::create_section(&root, nb.id, "Sec").unwrap();

    let asset_path =
        FsStorageEngine::import_asset_from_bytes(&root, sec.id, b"data", "txt").unwrap();
    assert!(root.join(&asset_path).exists());

    FsStorageEngine::delete_asset(&root, &asset_path).unwrap();
    assert!(!root.join(&asset_path).exists());
}

// ─── Trash ───

#[test]
fn restore_from_trash() {
    let (_dir, root) = setup_workspace();
    let nb = FsStorageEngine::create_notebook(&root, "NB").unwrap();
    let sec = FsStorageEngine::create_section(&root, nb.id, "Sec").unwrap();
    let page = FsStorageEngine::create_page(&root, sec.id, "Recoverable").unwrap();

    FsStorageEngine::delete_page(&root, page.id).unwrap();

    let trash = FsStorageEngine::list_trash_items(&root).unwrap();
    assert_eq!(trash.len(), 1);

    FsStorageEngine::restore_from_trash(&root, &trash[0].id).unwrap();

    let pages = FsStorageEngine::list_pages(&root, sec.id).unwrap();
    assert_eq!(pages.len(), 1);
    assert_eq!(pages[0].title, "Recoverable");

    let trash_after = FsStorageEngine::list_trash_items(&root).unwrap();
    assert!(trash_after.is_empty());
}

#[test]
fn permanently_delete_from_trash() {
    let (_dir, root) = setup_workspace();
    let nb = FsStorageEngine::create_notebook(&root, "NB").unwrap();

    FsStorageEngine::delete_notebook(&root, nb.id).unwrap();

    let trash = FsStorageEngine::list_trash_items(&root).unwrap();
    FsStorageEngine::permanently_delete(&root, &trash[0].id).unwrap();

    let trash_after = FsStorageEngine::list_trash_items(&root).unwrap();
    assert!(trash_after.is_empty());
}

#[test]
fn empty_trash() {
    let (_dir, root) = setup_workspace();
    let nb1 = FsStorageEngine::create_notebook(&root, "NB1").unwrap();
    let nb2 = FsStorageEngine::create_notebook(&root, "NB2").unwrap();

    FsStorageEngine::delete_notebook(&root, nb1.id).unwrap();
    FsStorageEngine::delete_notebook(&root, nb2.id).unwrap();

    assert_eq!(FsStorageEngine::list_trash_items(&root).unwrap().len(), 2);

    FsStorageEngine::empty_trash(&root).unwrap();

    assert!(FsStorageEngine::list_trash_items(&root).unwrap().is_empty());
}

// ─── Full workflow ───

#[test]
fn full_crud_workflow() {
    let (_dir, root) = setup_workspace();

    let nb = FsStorageEngine::create_notebook(&root, "Estudos").unwrap();
    let sec = FsStorageEngine::create_section(&root, nb.id, "Aulas").unwrap();
    let mut page = FsStorageEngine::create_page(&root, sec.id, "Aula 01 — Introdução").unwrap();

    page.add_tag("rust");
    page.add_block(opennote_core::block::Block::new_text(
        0,
        serde_json::json!({"text": "Hello, world!"}),
    ))
    .unwrap();
    page.add_block(opennote_core::block::Block::new_divider(1))
        .unwrap();
    FsStorageEngine::update_page(&root, &page).unwrap();

    let loaded = FsStorageEngine::load_page(&root, page.id).unwrap();
    assert_eq!(loaded.title, "Aula 01 — Introdução");
    assert_eq!(loaded.tags, vec!["rust"]);
    assert_eq!(loaded.block_count(), 2);

    let pages = FsStorageEngine::list_pages(&root, sec.id).unwrap();
    assert_eq!(pages.len(), 1);
    assert_eq!(pages[0].block_count, 2);

    FsStorageEngine::delete_page(&root, page.id).unwrap();
    assert!(FsStorageEngine::list_pages(&root, sec.id)
        .unwrap()
        .is_empty());

    let trash = FsStorageEngine::list_trash_items(&root).unwrap();
    assert_eq!(trash.len(), 1);
    FsStorageEngine::restore_from_trash(&root, &trash[0].id).unwrap();

    let restored_pages = FsStorageEngine::list_pages(&root, sec.id).unwrap();
    assert_eq!(restored_pages.len(), 1);
}

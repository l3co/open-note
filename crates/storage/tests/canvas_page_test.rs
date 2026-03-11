use opennote_core::page::{EditorMode, Page};
use opennote_storage::engine::FsStorageEngine;
use tempfile::TempDir;

fn setup_workspace() -> (TempDir, std::path::PathBuf) {
    let dir = TempDir::new().unwrap();
    let root = dir.path().to_path_buf();
    FsStorageEngine::create_workspace(&root, "Test Workspace").unwrap();
    (dir, root)
}

#[test]
fn create_and_load_canvas_page_roundtrip() {
    let (_dir, root) = setup_workspace();
    let nb = FsStorageEngine::create_notebook(&root, "NB").unwrap();
    let sec = FsStorageEngine::create_section(&root, nb.id, "Sec").unwrap();

    let page = Page::new_canvas(sec.id, "Meu Canvas").unwrap();
    let created = FsStorageEngine::create_page_from(&root, sec.id, page).unwrap();

    assert_eq!(created.editor_preferences.mode, EditorMode::Canvas);
    assert!(created.canvas_state.is_none());

    // Simular save do canvas_state
    let mut loaded = FsStorageEngine::load_page(&root, created.id).unwrap();
    let state = serde_json::json!({
        "elements": [{ "type": "rectangle", "id": "abc" }],
        "appState": { "viewBackgroundColor": "#ffffff" },
        "files": {}
    });
    loaded.update_canvas_state(Some(state.clone()));
    FsStorageEngine::update_page(&root, &loaded).unwrap();

    // Recarregar e verificar persistência
    let reloaded = FsStorageEngine::load_page(&root, created.id).unwrap();
    assert!(reloaded.canvas_state.is_some());
    let reloaded_state = reloaded.canvas_state.as_ref().unwrap();
    assert_eq!(reloaded_state["elements"].as_array().unwrap().len(), 1);
    assert_eq!(reloaded_state["elements"][0]["id"], "abc");
}

#[test]
fn canvas_page_clear_state() {
    let (_dir, root) = setup_workspace();
    let nb = FsStorageEngine::create_notebook(&root, "NB").unwrap();
    let sec = FsStorageEngine::create_section(&root, nb.id, "Sec").unwrap();

    let mut page = Page::new_canvas(sec.id, "Clear Test").unwrap();
    let state = serde_json::json!({ "elements": [] });
    page.update_canvas_state(Some(state));
    let created = FsStorageEngine::create_page_from(&root, sec.id, page).unwrap();

    let mut loaded = FsStorageEngine::load_page(&root, created.id).unwrap();
    assert!(loaded.canvas_state.is_some());

    // Limpar estado
    loaded.update_canvas_state(None);
    FsStorageEngine::update_page(&root, &loaded).unwrap();

    let reloaded = FsStorageEngine::load_page(&root, created.id).unwrap();
    assert!(reloaded.canvas_state.is_none());
}

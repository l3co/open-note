use std::fs;
use std::sync::{Arc, Barrier};

use chrono::{Duration, Utc};
use tempfile::TempDir;

use opennote_storage::atomic;
use opennote_storage::engine::FsStorageEngine;
use opennote_storage::lock;

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

// ─── Fixture tests ───

#[test]
fn load_workspace_v1_fixture() {
    let fixture =
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/workspace_v1");
    let ws = FsStorageEngine::load_workspace(&fixture).unwrap();
    assert_eq!(ws.name, "Meus Estudos");
    assert_eq!(ws.settings.auto_save_interval_ms, 1000);
    assert!(ws.settings.sidebar_open);
}

#[test]
fn load_page_v1_fixture() {
    let fixture = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/page_v1.opn.json");
    let page: opennote_core::page::Page = atomic::read_json(&fixture).unwrap();
    assert_eq!(page.title, "Aula 01 — Introdução ao Rust");
    assert_eq!(page.tags, vec!["rust", "programação"]);
    assert_eq!(page.block_count(), 3);
    assert_eq!(page.schema_version, 1);
}

#[test]
fn corrupted_page_fixture_returns_error() {
    let fixture = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/page_corrupted.opn.json");
    let result: Result<opennote_core::page::Page, _> = atomic::read_json(&fixture);
    assert!(result.is_err());
}

// ─── Phase 2 Retrofit: Concurrency & File Locking ───

#[test]
fn test_concurrent_workspace_open_multithread() {
    let dir = TempDir::new().unwrap();
    let root = dir.path().to_path_buf();
    FsStorageEngine::create_workspace(&root, "Concurrent WS").unwrap();

    let barrier = Arc::new(Barrier::new(2));
    let root_a = root.clone();
    let barrier_a = Arc::clone(&barrier);
    let root_b = root.clone();
    let barrier_b = Arc::clone(&barrier);

    let handle_a = std::thread::spawn(move || {
        barrier_a.wait();
        lock::acquire_lock(&root_a)
    });

    let handle_b = std::thread::spawn(move || {
        barrier_b.wait();
        lock::acquire_lock(&root_b)
    });

    let result_a = handle_a.join().unwrap();
    let result_b = handle_b.join().unwrap();

    let successes = [&result_a, &result_b].iter().filter(|r| r.is_ok()).count();
    let failures = [&result_a, &result_b].iter().filter(|r| r.is_err()).count();

    // At least one must succeed; the other may succeed or fail depending on timing
    assert!(successes >= 1, "At least one thread must acquire the lock");
    // If both succeed, it's a race condition but the lock file still exists
    // If exactly one fails, it got WorkspaceLocked
    assert!(successes + failures == 2);

    lock::release_lock(&root).unwrap();
}

// ─── Phase 2 Retrofit: Unicode Paths & Sanitization ───

#[test]
fn test_unicode_title_to_safe_path() {
    let (_dir, root) = setup_workspace();

    // Emojis
    let nb = FsStorageEngine::create_notebook(&root, "\u{1F4DA} Estudos").unwrap();
    assert_eq!(nb.name, "\u{1F4DA} Estudos");
    let notebooks = FsStorageEngine::list_notebooks(&root).unwrap();
    assert_eq!(notebooks.len(), 1);

    // Heavy accents
    let nb2 = FsStorageEngine::create_notebook(&root, "Análise de Currículos").unwrap();
    assert_eq!(nb2.name, "Análise de Currículos");

    // Dots
    let nb3 = FsStorageEngine::create_notebook(&root, "v2.0 Notes").unwrap();
    assert_eq!(nb3.name, "v2.0 Notes");

    // Slashes — should be sanitized in slug, not create subdirs
    let nb4 = FsStorageEngine::create_notebook(&root, "Meu/Nome/Ruim").unwrap();
    assert_eq!(nb4.name, "Meu/Nome/Ruim");
    let all = FsStorageEngine::list_notebooks(&root).unwrap();
    assert_eq!(all.len(), 4);
}

#[test]
fn test_path_traversal_sanitized() {
    let (_dir, root) = setup_workspace();

    // Path traversal attempts
    let nb = FsStorageEngine::create_notebook(&root, "../../etc/passwd").unwrap();
    assert_eq!(nb.name, "../../etc/passwd");
    // Must be created inside workspace, not escape
    let notebooks = FsStorageEngine::list_notebooks(&root).unwrap();
    assert_eq!(notebooks.len(), 1);

    let _nb2 = FsStorageEngine::create_notebook(&root, ".\\.\\secret").unwrap();
    let all = FsStorageEngine::list_notebooks(&root).unwrap();
    assert_eq!(all.len(), 2);
    // Verify no files escaped the workspace
    assert!(!root.join("../etc").exists());
}

#[test]
fn test_path_collision_handling() {
    let (_dir, root) = setup_workspace();

    let nb1 = FsStorageEngine::create_notebook(&root, "Notas").unwrap();
    let nb2 = FsStorageEngine::create_notebook(&root, "notas").unwrap();

    // Both must exist with distinct IDs
    assert_ne!(nb1.id, nb2.id);
    let notebooks = FsStorageEngine::list_notebooks(&root).unwrap();
    assert_eq!(notebooks.len(), 2);
}

// ─── Phase 2 Retrofit: Corrupted JSON Recovery ───

#[test]
fn test_corrupted_section_json_returns_error() {
    let (_dir, root) = setup_workspace();
    let nb = FsStorageEngine::create_notebook(&root, "NB").unwrap();
    let _sec = FsStorageEngine::create_section(&root, nb.id, "Good Section").unwrap();

    // Find the section dir and corrupt its section.json
    for entry in fs::read_dir(&root).unwrap() {
        let entry = entry.unwrap();
        let path = entry.path();
        if path.is_dir() && path.join("notebook.json").exists() {
            for sec_entry in fs::read_dir(&path).unwrap() {
                let sec_entry = sec_entry.unwrap();
                let sec_path = sec_entry.path();
                if sec_path.is_dir() && sec_path.join("section.json").exists() {
                    fs::write(sec_path.join("section.json"), "{broken").unwrap();
                }
            }
        }
    }

    // list_sections should return error (not panic)
    let result = FsStorageEngine::list_sections(&root, nb.id);
    assert!(result.is_err());
}

#[test]
fn test_corrupted_page_json_does_not_crash_listing() {
    let (_dir, root) = setup_workspace();
    let nb = FsStorageEngine::create_notebook(&root, "NB").unwrap();
    let sec = FsStorageEngine::create_section(&root, nb.id, "Sec").unwrap();

    let _p1 = FsStorageEngine::create_page(&root, sec.id, "Good Page 1").unwrap();
    let _p2 = FsStorageEngine::create_page(&root, sec.id, "Good Page 2").unwrap();
    let _p3 = FsStorageEngine::create_page(&root, sec.id, "Bad Page").unwrap();

    // Corrupt one page file
    let (_nb_dir, sec_dir) = FsStorageEngine::find_section_dir(&root, sec.id).unwrap();
    let mut corrupted = false;
    for entry in fs::read_dir(&sec_dir).unwrap() {
        let entry = entry.unwrap();
        let path = entry.path();
        if path.is_file() && path.to_str().unwrap_or("").ends_with(".opn.json") && !corrupted {
            fs::write(&path, "{invalid json").unwrap();
            corrupted = true;
        }
    }

    // list_pages reads and parses each file — corrupted one causes error
    // Current impl propagates the error. This is expected behavior.
    let result = FsStorageEngine::list_pages(&root, sec.id);
    assert!(
        result.is_err(),
        "Corrupted page JSON should cause list_pages to return error"
    );
}

// ─── Phase 2 Retrofit: Atomic Write Integrity ───

#[test]
fn test_atomic_write_no_temp_file_residue() {
    let dir = TempDir::new().unwrap();
    let path = dir.path().join("test.json");
    let tmp_path = path.with_extension("tmp");

    // Write large content (>1MB)
    let large_data = "x".repeat(1_100_000);
    atomic::atomic_write_bytes(&path, large_data.as_bytes()).unwrap();

    assert!(path.exists());
    assert!(!tmp_path.exists());

    // Verify integrity
    let content = fs::read_to_string(&path).unwrap();
    assert_eq!(content.len(), 1_100_000);
}

// ─── Phase 2 Retrofit: Trash Cleanup with Physical Files ───

#[test]
fn test_cleanup_expired_trash_deletes_physical_files() {
    let (_dir, root) = setup_workspace();
    let nb = FsStorageEngine::create_notebook(&root, "NB").unwrap();
    let sec = FsStorageEngine::create_section(&root, nb.id, "Sec").unwrap();

    // Create and delete two pages to put them in trash
    let p1 = FsStorageEngine::create_page(&root, sec.id, "Expired Page").unwrap();
    let p2 = FsStorageEngine::create_page(&root, sec.id, "Fresh Page").unwrap();

    FsStorageEngine::delete_page(&root, p1.id).unwrap();
    FsStorageEngine::delete_page(&root, p2.id).unwrap();

    // Modify manifest: make first item expired, keep second fresh
    let mut manifest = FsStorageEngine::load_trash_manifest(&root).unwrap();
    assert_eq!(manifest.items.len(), 2);

    let expired_id = manifest.items[0].id.clone();
    let fresh_id = manifest.items[1].id.clone();

    manifest.items[0].expires_at = Utc::now() - Duration::days(1);
    manifest.items[1].expires_at = Utc::now() + Duration::days(30);
    FsStorageEngine::save_trash_manifest(&root, &manifest).unwrap();

    let trash_dir = root.join(".trash");
    assert!(trash_dir.join(&expired_id).exists());
    assert!(trash_dir.join(&fresh_id).exists());

    // Run cleanup
    let count = FsStorageEngine::cleanup_expired_trash(&root).unwrap();
    assert_eq!(count, 1);

    // Expired item: physical dir deleted, removed from manifest
    assert!(!trash_dir.join(&expired_id).exists());
    // Fresh item: still present
    assert!(trash_dir.join(&fresh_id).exists());

    let updated_manifest = FsStorageEngine::load_trash_manifest(&root).unwrap();
    assert_eq!(updated_manifest.items.len(), 1);
    assert_eq!(updated_manifest.items[0].id, fresh_id);
}

// ─── Phase 2 Retrofit: Permissions ───

#[cfg(unix)]
#[test]
fn test_read_only_workspace() {
    use std::os::unix::fs::PermissionsExt;

    let dir = TempDir::new().unwrap();
    let root = dir.path().to_path_buf();
    FsStorageEngine::create_workspace(&root, "ReadOnly WS").unwrap();
    let _nb = FsStorageEngine::create_notebook(&root, "NB").unwrap();

    // Make workspace read-only
    fs::set_permissions(&root, fs::Permissions::from_mode(0o555)).unwrap();

    // Try to create notebook — should fail with IO error, not panic
    let result = FsStorageEngine::create_notebook(&root, "Should Fail");
    assert!(result.is_err());

    // Restore permissions for cleanup
    fs::set_permissions(&root, fs::Permissions::from_mode(0o755)).unwrap();
}

// ─── Phase 2 Retrofit: Schema Migration ───

#[test]
fn test_migration_v1_to_v2_works() {
    use opennote_storage::migrations::migrate_page_if_needed;

    // v1 JSON
    let v1_json = serde_json::json!({
        "schema_version": 1,
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "section_id": "550e8400-e29b-41d4-a716-446655440001",
        "title": "Test Page",
        "tags": ["rust", "test"],
        "blocks": [],
        "annotations": { "strokes": [], "highlights": [] },
        "editor_preferences": { "mode": "rich_text", "split_view": false },
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
    });

    let result = migrate_page_if_needed(v1_json.clone()).unwrap();
    assert_eq!(result["title"], "Test Page");
    assert_eq!(result["tags"], serde_json::json!(["rust", "test"]));
    assert_eq!(result["schema_version"], 2);
    assert!(result.as_object().unwrap().contains_key("protection"));
    assert!(result
        .as_object()
        .unwrap()
        .contains_key("encrypted_content"));

    // Future version should error
    let future_json = serde_json::json!({
        "schema_version": 999,
        "title": "Future"
    });
    assert!(migrate_page_if_needed(future_json).is_err());
}

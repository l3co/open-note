use opennote_core::id::TemplateId;
use opennote_core::template::{NoteTemplate, TemplateCategory};
use opennote_storage::engine::FsStorageEngine;
use tempfile::tempdir;

#[test]
fn list_templates_empty_when_no_dir() {
    let root = tempdir().unwrap();
    let templates = FsStorageEngine::list_templates(root.path()).unwrap();
    assert!(templates.is_empty());
}

#[test]
fn save_and_list_template() {
    let root = tempdir().unwrap();
    let template = NoteTemplate::new("Meeting", TemplateCategory::Meeting, "Reunião").unwrap();

    FsStorageEngine::save_template(root.path(), &template).unwrap();

    let templates = FsStorageEngine::list_templates(root.path()).unwrap();
    assert_eq!(templates.len(), 1);
    assert_eq!(templates[0].name, "Meeting");
}

#[test]
fn load_template_by_id() {
    let root = tempdir().unwrap();
    let template = NoteTemplate::new("Study", TemplateCategory::Study, "Study Log").unwrap();
    let id = template.id;

    FsStorageEngine::save_template(root.path(), &template).unwrap();

    let loaded = FsStorageEngine::load_template(root.path(), id).unwrap();
    assert_eq!(loaded.name, "Study");
    assert_eq!(loaded.id, id);
}

#[test]
fn delete_template_removes_file() {
    let root = tempdir().unwrap();
    let template = NoteTemplate::new("Daily", TemplateCategory::Journal, "Diary").unwrap();
    let id = template.id;

    FsStorageEngine::save_template(root.path(), &template).unwrap();
    assert_eq!(
        FsStorageEngine::list_templates(root.path()).unwrap().len(),
        1
    );

    FsStorageEngine::delete_template(root.path(), id).unwrap();
    assert_eq!(
        FsStorageEngine::list_templates(root.path()).unwrap().len(),
        0
    );
}

#[test]
fn delete_nonexistent_returns_error() {
    let root = tempdir().unwrap();
    let res = FsStorageEngine::delete_template(root.path(), TemplateId::new());
    assert!(res.is_err());
}

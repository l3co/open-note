use std::fs;

use opennote_core::settings::CURRENT_APP_STATE_VERSION;
use opennote_storage::migrations::{
    backup_before_migration, migrate_app_state_if_needed, migrate_app_state_v1_to_v2,
};
use serde_json::{json, Value};

// ── Unit tests for pure migration function ────────────────────────────────────

#[test]
fn migrate_v1_minimal_adds_defaults() {
    let v1 = json!({
        "recent_workspaces": [],
        "last_opened_workspace": null,
        "global_settings": {
            "theme": { "base_theme": "system", "accent_color": "Blue", "chrome_tint": "neutral" },
            "language": "en",
            "window_bounds": null
        }
    });

    let v2 = migrate_app_state_v1_to_v2(v1);

    assert_eq!(v2["schema_version"], CURRENT_APP_STATE_VERSION);
    assert_eq!(v2["active_workspaces"], json!([]));
    assert_eq!(v2["focused_workspace_id"], Value::Null);
}

#[test]
fn migrate_v1_preserves_existing_fields() {
    let v1 = json!({
        "recent_workspaces": [
            { "path": "/tmp/notes", "name": "My Notes", "last_opened_at": "2024-01-01T00:00:00Z" }
        ],
        "last_opened_workspace": "/tmp/notes",
        "global_settings": {
            "theme": { "base_theme": "dark", "accent_color": "Blue", "chrome_tint": "neutral" },
            "language": "pt-BR",
            "window_bounds": null
        }
    });

    let v2 = migrate_app_state_v1_to_v2(v1);

    assert_eq!(v2["schema_version"], CURRENT_APP_STATE_VERSION);
    assert_eq!(v2["recent_workspaces"][0]["name"], "My Notes");
    assert_eq!(v2["last_opened_workspace"], "/tmp/notes");
    assert_eq!(v2["global_settings"]["language"], "pt-BR");
    assert_eq!(v2["global_settings"]["theme"]["base_theme"], "dark");
}

#[test]
fn migrate_v1_idempotent() {
    let v1 = json!({
        "recent_workspaces": [],
        "last_opened_workspace": null,
        "global_settings": {
            "theme": { "base_theme": "system", "accent_color": "Blue", "chrome_tint": "neutral" },
            "language": "en",
            "window_bounds": null
        }
    });

    let once = migrate_app_state_v1_to_v2(v1.clone());
    let twice = migrate_app_state_v1_to_v2(once.clone());

    assert_eq!(once["schema_version"], twice["schema_version"]);
    assert_eq!(once["active_workspaces"], twice["active_workspaces"]);
    assert_eq!(once["focused_workspace_id"], twice["focused_workspace_id"]);
}

#[test]
fn migrate_v1_already_has_active_workspaces_preserved() {
    let v1_with_data = json!({
        "active_workspaces": [{ "id": "existing-id", "path": "/tmp/ws", "name": "WS", "opened_at": "2024-01-01T00:00:00Z" }],
        "recent_workspaces": [],
        "last_opened_workspace": null,
        "global_settings": {
            "theme": { "base_theme": "system", "accent_color": "Blue", "chrome_tint": "neutral" },
            "language": "en",
            "window_bounds": null
        }
    });

    let v2 = migrate_app_state_v1_to_v2(v1_with_data);

    // Should not overwrite existing active_workspaces
    assert_eq!(v2["active_workspaces"][0]["name"], "WS");
    assert_eq!(v2["schema_version"], CURRENT_APP_STATE_VERSION);
}

// ── Integration tests with migrate_app_state_if_needed ───────────────────────

#[test]
fn migrate_pipeline_v2_no_migration() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("app_state.json");

    let v2 = json!({
        "schema_version": 2,
        "recent_workspaces": [],
        "active_workspaces": [],
        "focused_workspace_id": null,
        "last_opened_workspace": null,
        "global_settings": {
            "theme": { "base_theme": "system", "accent_color": "Blue", "chrome_tint": "neutral" },
            "language": "en",
            "window_bounds": null
        }
    });

    let result = migrate_app_state_if_needed(v2.clone(), &path).unwrap();
    assert_eq!(result["schema_version"], 2);
    // No backup should be created for already-current version
    let backup = dir.path().join("app_state.json.v1.backup");
    assert!(!backup.exists());
}

#[test]
fn migrate_pipeline_v1_migrates_to_v2() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("app_state.json");

    // Write a v1 file so backup can be created
    let v1 = json!({
        "recent_workspaces": [],
        "last_opened_workspace": null,
        "global_settings": {
            "theme": { "base_theme": "system", "accent_color": "Blue", "chrome_tint": "neutral" },
            "language": "en",
            "window_bounds": null
        }
    });
    fs::write(&path, serde_json::to_string(&v1).unwrap()).unwrap();

    let result = migrate_app_state_if_needed(v1, &path).unwrap();

    assert_eq!(result["schema_version"], CURRENT_APP_STATE_VERSION);
    assert_eq!(result["active_workspaces"], json!([]));
}

#[test]
fn backup_created_before_migration() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("app_state.json");
    fs::write(&path, b"{}").unwrap();

    let v1 = json!({
        "recent_workspaces": [],
        "last_opened_workspace": null,
        "global_settings": {
            "theme": { "base_theme": "system", "accent_color": "Blue", "chrome_tint": "neutral" },
            "language": "en",
            "window_bounds": null
        }
    });

    migrate_app_state_if_needed(v1, &path).unwrap();

    let backup = dir.path().join("app_state.json.v1.backup");
    assert!(backup.exists(), "Backup file must exist after migration");
}

#[test]
fn backup_is_idempotent() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("app_state.json");
    fs::write(&path, b"original-content").unwrap();

    backup_before_migration(&path, 1).unwrap();
    let backup = dir.path().join("app_state.json.v1.backup");
    let first_content = fs::read(&backup).unwrap();

    // Write different content to original, then backup again
    fs::write(&path, b"new-content").unwrap();
    backup_before_migration(&path, 1).unwrap();
    let second_content = fs::read(&backup).unwrap();

    assert_eq!(
        first_content, second_content,
        "Backup must not be overwritten (idempotent)"
    );
}

#[test]
fn unknown_version_returns_error() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("app_state.json");

    let future = json!({ "schema_version": 99 });
    let result = migrate_app_state_if_needed(future, &path);

    assert!(result.is_err());
    let err = result.unwrap_err().to_string();
    assert!(
        err.contains("99") || err.contains("mismatch"),
        "Error should mention version: {err}"
    );
}

#[test]
fn missing_file_returns_default_via_engine() {
    // Verify AppState::default() has the current schema version
    let default = opennote_core::settings::AppState::default();
    assert_eq!(default.schema_version, CURRENT_APP_STATE_VERSION);
    assert!(default.recent_workspaces.is_empty());
    assert!(default.active_workspaces.is_empty());
    assert!(default.focused_workspace_id.is_none());
}

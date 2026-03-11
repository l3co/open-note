use std::path::Path;

use serde_json::Value;

use crate::error::{StorageError, StorageResult};
use opennote_core::page::CURRENT_SCHEMA_VERSION;
use opennote_core::settings::CURRENT_APP_STATE_VERSION;

// ── AppState migrations ───────────────────────────────────────────────────────

/// Migrates AppState JSON from v1 (no active_workspaces) to v2.
/// Pure function: receives a JSON Value, returns migrated JSON Value.
pub fn migrate_app_state_v1_to_v2(mut state: Value) -> Value {
    let obj = state.as_object_mut().expect("AppState must be an object");
    if !obj.contains_key("active_workspaces") {
        obj.insert("active_workspaces".into(), Value::Array(vec![]));
    }
    if !obj.contains_key("focused_workspace_id") {
        obj.insert("focused_workspace_id".into(), Value::Null);
    }
    obj.insert(
        "schema_version".into(),
        Value::Number(CURRENT_APP_STATE_VERSION.into()),
    );
    state
}

/// Creates a versioned backup of `path` before migration (idempotent).
pub fn backup_before_migration(path: &Path, from_version: u32) -> StorageResult<()> {
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".into());
    let backup_name = format!("{}.v{}.backup", file_name, from_version);
    let backup_path = path.with_file_name(backup_name);
    if !backup_path.exists() {
        std::fs::copy(path, &backup_path)?;
    }
    Ok(())
}

/// Runs the AppState migration pipeline.
/// Returns the migrated JSON Value (caller is responsible for saving).
pub fn migrate_app_state_if_needed(raw: Value, path: &Path) -> StorageResult<Value> {
    let version = raw
        .get("schema_version")
        .and_then(|v| v.as_u64())
        .unwrap_or(1) as u32;

    if version > CURRENT_APP_STATE_VERSION {
        return Err(StorageError::SchemaVersionMismatch {
            expected: CURRENT_APP_STATE_VERSION,
            found: version,
        });
    }

    if version == CURRENT_APP_STATE_VERSION {
        return Ok(raw);
    }

    // Need migration — backup first
    backup_before_migration(path, version)?;

    let mut current = version;
    let mut json = raw;
    while current < CURRENT_APP_STATE_VERSION {
        json = match current {
            1 => migrate_app_state_v1_to_v2(json),
            _ => json,
        };
        current += 1;
    }

    Ok(json)
}

// ── Page migrations ───────────────────────────────────────────────────────────

pub fn migrate_page_v1_to_v2(mut json: Value) -> Value {
    let obj = json.as_object_mut().expect("Page must be an object");
    if !obj.contains_key("protection") {
        obj.insert("protection".into(), Value::Null);
    }
    if !obj.contains_key("encrypted_content") {
        obj.insert("encrypted_content".into(), Value::Null);
    }
    obj.insert(
        "schema_version".into(),
        Value::Number(CURRENT_SCHEMA_VERSION.into()),
    );
    json
}

pub fn migrate_page_if_needed(mut json: Value) -> StorageResult<Value> {
    let version = json
        .get("schema_version")
        .and_then(|v| v.as_u64())
        .unwrap_or(1) as u32;

    if version > CURRENT_SCHEMA_VERSION {
        return Err(StorageError::SchemaVersionMismatch {
            expected: CURRENT_SCHEMA_VERSION,
            found: version,
        });
    }

    if version == CURRENT_SCHEMA_VERSION {
        return Ok(json);
    }

    let mut current = version;
    while current < CURRENT_SCHEMA_VERSION {
        json = match current {
            1 => migrate_page_v1_to_v2(json),
            _ => json,
        };
        current += 1;
    }

    Ok(json)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn current_version_needs_no_migration() {
        let json = serde_json::json!({
            "schema_version": CURRENT_SCHEMA_VERSION,
            "title": "Test"
        });
        let result = migrate_page_if_needed(json.clone()).unwrap();
        assert_eq!(result, json);
    }

    #[test]
    fn future_version_returns_error() {
        let json = serde_json::json!({
            "schema_version": CURRENT_SCHEMA_VERSION + 1,
            "title": "Test"
        });
        let result = migrate_page_if_needed(json);
        assert!(result.is_err());
    }

    #[test]
    fn missing_version_defaults_to_1() {
        let json = serde_json::json!({
            "title": "Test"
        });
        let result = migrate_page_if_needed(json).unwrap();
        assert_eq!(result["schema_version"], CURRENT_SCHEMA_VERSION);
    }
}

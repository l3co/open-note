use serde_json::Value;

use crate::error::{StorageError, StorageResult};
use opennote_core::page::CURRENT_SCHEMA_VERSION;

pub fn migrate_if_needed(mut json: Value) -> StorageResult<Value> {
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

    let mut current = version;
    while current < CURRENT_SCHEMA_VERSION {
        json = apply_migration(current, json)?;
        current += 1;
    }

    Ok(json)
}

#[allow(clippy::match_single_binding)]
fn apply_migration(from_version: u32, json: Value) -> StorageResult<Value> {
    match from_version {
        // Future migrations go here: 1 => migrate_v1_to_v2(json),
        _ => Ok(json),
    }
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
        let result = migrate_if_needed(json.clone()).unwrap();
        assert_eq!(result, json);
    }

    #[test]
    fn future_version_returns_error() {
        let json = serde_json::json!({
            "schema_version": CURRENT_SCHEMA_VERSION + 1,
            "title": "Test"
        });
        let result = migrate_if_needed(json);
        assert!(result.is_err());
    }

    #[test]
    fn missing_version_defaults_to_1() {
        let json = serde_json::json!({
            "title": "Test"
        });
        let result = migrate_if_needed(json);
        assert!(result.is_ok());
    }
}

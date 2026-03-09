# Data Migration — AppState v1 → v2

## Schema Changes

| Field | v1 | v2 |
|---|---|---|
| `schema_version` | absent (defaults to 1) | `2` |
| `active_workspaces` | absent | `[]` (default) |
| `focused_workspace_id` | absent | `null` (default) |
| all other fields | unchanged | unchanged |

## Automatic Migration

Migration runs automatically in `FsStorageEngine::load_app_state()`:

1. Read `~/.opennote/app_state.json` as raw JSON
2. Check `schema_version` (defaults to `1` if absent)
3. If version < 2 → run `migrate_app_state_v1_to_v2`, save backup, persist migrated file
4. If version == 2 → load directly
5. If version > 2 → return `SchemaVersionMismatch` error

## Backup

Before migrating, a versioned backup is created alongside the original:

```
~/.opennote/app_state.json           ← migrated (v2)
~/.opennote/app_state.json.v1.backup ← original (v1)
```

The backup is idempotent — will not overwrite an existing backup.

## Rollback

To manually roll back after migration:

```bash
cp ~/.opennote/app_state.json.v1.backup ~/.opennote/app_state.json
```

## Testing Migration Locally

```bash
# Run migration unit tests
cargo test -p opennote-storage --test migration_test

# Test with a synthetic v1 file
echo '{"recent_workspaces":[],"last_opened_workspace":null,"global_settings":{"theme":{"base_theme":"system","accent_color":"Blue","chrome_tint":"neutral"},"language":"en","window_bounds":null}}' \
  > ~/.opennote/app_state.json
# Then launch the app — migration runs automatically
```

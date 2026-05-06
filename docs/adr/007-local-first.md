# ADR-007: Local-First, Cloud-Aware Strategy

## Status
Accepted

## Context
Open Note needs to define the relationship between local data and cloud synchronization. This decision impacts UX, data architecture, the startup flow, and the consistency model.

## Alternatives Considered

| Option | Description |
|---|---|
| **Cloud-first** | Primary data in the cloud, local cache. Requires connectivity. |
| **Local-only** | No sync option at all. Data only on the filesystem. |
| **Local-first, cloud-aware** | Local data is the source of truth. Sync is opt-in. UI shows cloud options from the start. |

## Decision
Adopt **Local-First, Cloud-Aware**.

## Principles

1. **Workspace always starts local.** Works 100% offline.
2. **Cloud is opt-in.** "Connect to cloud" button visible from WorkspacePicker.
3. **Migrate local → cloud at any time** via Settings → Sync.
4. **Disconnecting never deletes data.** Both copies (local and remote) remain intact.
5. **No mandatory account.** The app works completely without a login.

## Sync Flow

```
1. User opens Settings → Sync
2. Chooses provider (Google Drive / OneDrive / Dropbox)
3. OAuth2 → authorization
4. Initial upload of local files
5. Bidirectional sync enabled (configurable interval, default 5 min)
6. Conflicts detected → resolution UI (KeepLocal / KeepRemote / KeepBoth)
```

## Visual Indicators

| Icon | State |
|---|---|
| 📂 | Local workspace (no sync) |
| ☁️ | Sync active and healthy |
| ☁️⚠ | Sync error or pending conflicts |

## Rationale
- **Privacy:** User data never leaves the device without explicit consent
- **Reliability:** App works without internet
- **Simplicity:** Clear mental model — local filesystem is the source of truth
- **No vendor lock-in:** Sync uses generic providers (GDrive/OneDrive/Dropbox), not a proprietary server
- **Progressiveness:** User starts simple (local) and adds complexity (sync) when ready

## Consequences

### Positive
- Zero server dependency for basic operation
- Data always available offline
- Easy to migrate between machines (copy the folder)
- No infrastructure costs for the project

### Negative
- File-level sync (not block-level) may generate conflicts with simultaneous editing
- No real-time collaboration (out of scope for v1)
- User responsible for backups if not using sync

### Risks
- Frequent conflicts if the same workspace is edited on 2 machines (mitigated: conflict detection + resolution UI)
- Data loss if disk fails without sync (mitigated: clear documentation about the importance of backups)

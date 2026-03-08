export type SyncProviderType = "google_drive" | "onedrive" | "dropbox";

export interface ProviderInfo {
  name: string;
  display_name: string;
  connected: boolean;
  user_email: string | null;
  last_synced_at: string | null;
}

export interface SyncStatus {
  is_syncing: boolean;
  provider: string | null;
  progress: SyncProgress | null;
  last_synced_at: string | null;
  last_error: string | null;
  pending_conflicts: number;
}

export interface SyncProgress {
  phase: "comparing" | "uploading" | "downloading" | "finalizing";
  current: number;
  total: number;
}

export interface SyncPreferences {
  enabled: boolean;
  provider: SyncProviderType | null;
  interval_seconds: number;
  synced_notebook_ids: string[];
}

export interface SyncConflict {
  id: string;
  page_title: string;
  local_modified_at: string;
  remote_modified_at: string;
  local_path: string;
  conflict_path: string;
}

export type ConflictResolution = "keep_local" | "keep_remote" | "keep_both";

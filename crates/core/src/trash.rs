use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub const DEFAULT_TRASH_RETENTION_DAYS: i64 = 30;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct TrashManifest {
    pub items: Vec<TrashItem>,
}

impl Default for TrashManifest {
    fn default() -> Self {
        Self::new()
    }
}

impl TrashManifest {
    pub fn new() -> Self {
        Self { items: Vec::new() }
    }

    pub fn add_item(&mut self, item: TrashItem) {
        self.items.push(item);
    }

    pub fn remove_item(&mut self, trash_item_id: &str) -> Option<TrashItem> {
        if let Some(pos) = self.items.iter().position(|i| i.id == trash_item_id) {
            Some(self.items.remove(pos))
        } else {
            None
        }
    }

    pub fn find_item(&self, trash_item_id: &str) -> Option<&TrashItem> {
        self.items.iter().find(|i| i.id == trash_item_id)
    }

    pub fn expired_items(&self, now: DateTime<Utc>) -> Vec<&TrashItem> {
        self.items.iter().filter(|i| i.expires_at <= now).collect()
    }

    pub fn remove_expired(&mut self, now: DateTime<Utc>) -> Vec<TrashItem> {
        let (expired, kept): (Vec<_>, Vec<_>) =
            self.items.drain(..).partition(|i| i.expires_at <= now);
        self.items = kept;
        expired
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct TrashItem {
    pub id: String,
    pub item_type: TrashItemType,
    pub original_title: String,
    pub original_path: String,
    pub original_notebook: String,
    pub original_section: Option<String>,
    pub deleted_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub size_bytes: u64,
}

impl TrashItem {
    pub fn new(
        item_type: TrashItemType,
        original_title: String,
        original_path: String,
        original_notebook: String,
        original_section: Option<String>,
        size_bytes: u64,
    ) -> Self {
        let now = Utc::now();
        let expires_at = now + Duration::days(DEFAULT_TRASH_RETENTION_DAYS);
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            item_type,
            original_title,
            original_path,
            original_notebook,
            original_section,
            deleted_at: now,
            expires_at,
            size_bytes,
        }
    }

    pub fn is_expired(&self, now: DateTime<Utc>) -> bool {
        self.expires_at <= now
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
#[serde(rename_all = "snake_case")]
pub enum TrashItemType {
    Page,
    Section,
    Notebook,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_trash_item_expires_in_30_days() {
        let item = TrashItem::new(
            TrashItemType::Page,
            "Test".to_string(),
            "nb/sec/test.opn.json".to_string(),
            "Notebook".to_string(),
            Some("Section".to_string()),
            1024,
        );
        let diff = item.expires_at - item.deleted_at;
        assert_eq!(diff.num_days(), DEFAULT_TRASH_RETENTION_DAYS);
    }

    #[test]
    fn trash_manifest_add_and_find() {
        let mut manifest = TrashManifest::new();
        let item = TrashItem::new(
            TrashItemType::Page,
            "Test".to_string(),
            "path".to_string(),
            "NB".to_string(),
            None,
            0,
        );
        let id = item.id.clone();
        manifest.add_item(item);

        assert!(manifest.find_item(&id).is_some());
        assert!(manifest.find_item("nonexistent").is_none());
    }

    #[test]
    fn trash_manifest_remove_item() {
        let mut manifest = TrashManifest::new();
        let item = TrashItem::new(
            TrashItemType::Notebook,
            "NB".to_string(),
            "path".to_string(),
            "NB".to_string(),
            None,
            0,
        );
        let id = item.id.clone();
        manifest.add_item(item);

        let removed = manifest.remove_item(&id);
        assert!(removed.is_some());
        assert!(manifest.items.is_empty());
    }

    #[test]
    fn remove_expired_items() {
        let mut manifest = TrashManifest::new();
        let mut old_item = TrashItem::new(
            TrashItemType::Page,
            "Old".to_string(),
            "path".to_string(),
            "NB".to_string(),
            None,
            0,
        );
        old_item.expires_at = Utc::now() - Duration::days(1);
        manifest.add_item(old_item);

        let fresh_item = TrashItem::new(
            TrashItemType::Page,
            "Fresh".to_string(),
            "path2".to_string(),
            "NB".to_string(),
            None,
            0,
        );
        manifest.add_item(fresh_item);

        let expired = manifest.remove_expired(Utc::now());
        assert_eq!(expired.len(), 1);
        assert_eq!(expired[0].original_title, "Old");
        assert_eq!(manifest.items.len(), 1);
        assert_eq!(manifest.items[0].original_title, "Fresh");
    }

    #[test]
    fn test_trash_expiration_boundary_exact() {
        let now = Utc::now();
        let mut manifest = TrashManifest::new();

        let mut item_a = TrashItem::new(
            TrashItemType::Page,
            "Expired".to_string(),
            "path_a".to_string(),
            "NB".to_string(),
            None,
            0,
        );
        item_a.expires_at = now - Duration::seconds(1);
        manifest.add_item(item_a);

        let mut item_b = TrashItem::new(
            TrashItemType::Page,
            "Retained".to_string(),
            "path_b".to_string(),
            "NB".to_string(),
            None,
            0,
        );
        item_b.expires_at = now + Duration::seconds(1);
        manifest.add_item(item_b);

        let expired = manifest.remove_expired(now);
        assert_eq!(expired.len(), 1);
        assert_eq!(expired[0].original_title, "Expired");
        assert_eq!(manifest.items.len(), 1);
        assert_eq!(manifest.items[0].original_title, "Retained");
    }
}

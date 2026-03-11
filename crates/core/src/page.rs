use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::annotation::PageAnnotations;
use crate::block::Block;
use crate::error::CoreError;
use crate::id::{PageId, SectionId};

pub const CURRENT_SCHEMA_VERSION: u32 = 1;
pub const SOFT_BLOCK_LIMIT: usize = 200;
pub const HARD_BLOCK_LIMIT: usize = 500;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct Page {
    pub id: PageId,
    pub section_id: SectionId,
    pub title: String,
    pub tags: Vec<String>,
    pub blocks: Vec<Block>,
    pub annotations: PageAnnotations,
    pub editor_preferences: EditorPreferences,
    #[serde(default)]
    pub pdf_asset: Option<String>,
    #[serde(default)]
    pub pdf_total_pages: Option<u32>,
    #[serde(default)]
    #[ts(type = "any | null")]
    pub canvas_state: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub schema_version: u32,
}

impl Page {
    pub fn new(section_id: SectionId, title: &str) -> Result<Self, CoreError> {
        let title = title.trim().to_string();
        if title.is_empty() {
            return Err(CoreError::Validation {
                message: "Page title cannot be empty".to_string(),
            });
        }

        let now = Utc::now();
        Ok(Self {
            id: PageId::new(),
            section_id,
            title,
            tags: Vec::new(),
            blocks: Vec::new(),
            annotations: PageAnnotations::default(),
            editor_preferences: EditorPreferences::default(),
            pdf_asset: None,
            pdf_total_pages: None,
            canvas_state: None,
            created_at: now,
            updated_at: now,
            schema_version: CURRENT_SCHEMA_VERSION,
        })
    }

    pub fn new_pdf_canvas(
        section_id: SectionId,
        title: &str,
        pdf_asset: &str,
        pdf_total_pages: u32,
    ) -> Result<Self, CoreError> {
        let title = title.trim().to_string();
        if title.is_empty() {
            return Err(CoreError::Validation {
                message: "Page title cannot be empty".to_string(),
            });
        }
        if pdf_asset.is_empty() {
            return Err(CoreError::Validation {
                message: "PDF asset path cannot be empty".to_string(),
            });
        }
        let now = Utc::now();
        Ok(Self {
            id: PageId::new(),
            section_id,
            title,
            tags: Vec::new(),
            blocks: Vec::new(),
            annotations: PageAnnotations::default(),
            editor_preferences: EditorPreferences {
                mode: EditorMode::PdfCanvas,
                split_view: false,
            },
            pdf_asset: Some(pdf_asset.to_string()),
            pdf_total_pages: Some(pdf_total_pages),
            canvas_state: None,
            created_at: now,
            updated_at: now,
            schema_version: CURRENT_SCHEMA_VERSION,
        })
    }

    pub fn new_canvas(section_id: SectionId, title: &str) -> Result<Self, CoreError> {
        let title = title.trim().to_string();
        if title.is_empty() {
            return Err(CoreError::Validation {
                message: "Page title cannot be empty".to_string(),
            });
        }
        let now = Utc::now();
        Ok(Self {
            id: PageId::new(),
            section_id,
            title,
            tags: Vec::new(),
            blocks: Vec::new(),
            annotations: PageAnnotations::default(),
            editor_preferences: EditorPreferences {
                mode: EditorMode::Canvas,
                split_view: false,
            },
            pdf_asset: None,
            pdf_total_pages: None,
            canvas_state: None,
            created_at: now,
            updated_at: now,
            schema_version: CURRENT_SCHEMA_VERSION,
        })
    }

    pub fn add_block(&mut self, block: Block) -> Result<(), CoreError> {
        if self.blocks.len() >= HARD_BLOCK_LIMIT {
            return Err(CoreError::Validation {
                message: format!("Page has reached the hard block limit of {HARD_BLOCK_LIMIT}"),
            });
        }
        self.blocks.push(block);
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn is_over_soft_limit(&self) -> bool {
        self.blocks.len() > SOFT_BLOCK_LIMIT
    }

    pub fn block_count(&self) -> usize {
        self.blocks.len()
    }

    pub fn rename(&mut self, new_title: &str) -> Result<(), CoreError> {
        let new_title = new_title.trim().to_string();
        if new_title.is_empty() {
            return Err(CoreError::Validation {
                message: "Page title cannot be empty".to_string(),
            });
        }
        self.title = new_title;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn add_tag(&mut self, tag: &str) {
        let tag = tag.trim().to_lowercase();
        if !tag.is_empty() && !self.tags.contains(&tag) {
            self.tags.push(tag);
            self.updated_at = Utc::now();
        }
    }

    pub fn remove_tag(&mut self, tag: &str) -> bool {
        let tag = tag.trim().to_lowercase();
        let len_before = self.tags.len();
        self.tags.retain(|t| t != &tag);
        if self.tags.len() != len_before {
            self.updated_at = Utc::now();
            true
        } else {
            false
        }
    }

    pub fn reorder_blocks(&mut self) {
        self.blocks.sort_by_key(|b| b.order());
        for (i, block) in self.blocks.iter_mut().enumerate() {
            match block {
                Block::Text(b) => b.base.order = i as u32,
                Block::Markdown(b) => b.base.order = i as u32,
                Block::Code(b) => b.base.order = i as u32,
                Block::Checklist(b) => b.base.order = i as u32,
                Block::Table(b) => b.base.order = i as u32,
                Block::Image(b) => b.base.order = i as u32,
                Block::Ink(b) => b.base.order = i as u32,
                Block::Pdf(b) => b.base.order = i as u32,
                Block::Divider(b) => b.base.order = i as u32,
                Block::Callout(b) => b.base.order = i as u32,
                Block::Embed(b) => b.base.order = i as u32,
            }
        }
    }

    pub fn update_canvas_state(&mut self, state: Option<serde_json::Value>) {
        self.canvas_state = state;
        self.updated_at = Utc::now();
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct PageSummary {
    pub id: PageId,
    pub title: String,
    pub tags: Vec<String>,
    pub mode: EditorMode,
    pub block_count: usize,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<&Page> for PageSummary {
    fn from(page: &Page) -> Self {
        Self {
            id: page.id,
            title: page.title.clone(),
            tags: page.tags.clone(),
            mode: page.editor_preferences.mode,
            block_count: page.blocks.len(),
            created_at: page.created_at,
            updated_at: page.updated_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct EditorPreferences {
    pub mode: EditorMode,
    pub split_view: bool,
}

impl Default for EditorPreferences {
    fn default() -> Self {
        Self {
            mode: EditorMode::RichText,
            split_view: false,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
#[serde(rename_all = "snake_case")]
pub enum EditorMode {
    RichText,
    Markdown,
    PdfCanvas,
    Canvas,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::block::Block;

    #[test]
    fn create_page_with_valid_title() {
        let page = Page::new(SectionId::new(), "Aula 01").unwrap();
        assert_eq!(page.title, "Aula 01");
        assert_eq!(page.schema_version, CURRENT_SCHEMA_VERSION);
        assert!(page.blocks.is_empty());
    }

    #[test]
    fn reject_empty_page_title() {
        assert!(Page::new(SectionId::new(), "").is_err());
    }

    #[test]
    fn add_and_remove_tags() {
        let mut page = Page::new(SectionId::new(), "Test").unwrap();
        page.add_tag("important");
        page.add_tag("study");
        page.add_tag("IMPORTANT"); // duplicate (case-insensitive)

        assert_eq!(page.tags.len(), 2);
        assert!(page.remove_tag("important"));
        assert_eq!(page.tags.len(), 1);
        assert!(!page.remove_tag("nonexistent"));
    }

    #[test]
    fn add_block_respects_hard_limit() {
        let mut page = Page::new(SectionId::new(), "Test").unwrap();
        for i in 0..HARD_BLOCK_LIMIT {
            page.add_block(Block::new_divider(i as u32)).unwrap();
        }
        assert!(page.add_block(Block::new_divider(500)).is_err());
    }

    #[test]
    fn soft_limit_detection() {
        let mut page = Page::new(SectionId::new(), "Test").unwrap();
        assert!(!page.is_over_soft_limit());

        for i in 0..=SOFT_BLOCK_LIMIT {
            page.add_block(Block::new_divider(i as u32)).unwrap();
        }
        assert!(page.is_over_soft_limit());
    }

    #[test]
    fn page_summary_from_page() {
        let mut page = Page::new(SectionId::new(), "My Page").unwrap();
        page.add_block(Block::new_divider(0)).unwrap();
        page.add_tag("test");

        let summary = PageSummary::from(&page);
        assert_eq!(summary.title, "My Page");
        assert_eq!(summary.block_count, 1);
        assert_eq!(summary.tags, vec!["test"]);
    }

    #[test]
    fn reorder_blocks_normalizes_order() {
        let mut page = Page::new(SectionId::new(), "Test").unwrap();
        page.add_block(Block::new_divider(10)).unwrap();
        page.add_block(Block::new_divider(5)).unwrap();
        page.add_block(Block::new_divider(20)).unwrap();

        page.reorder_blocks();

        assert_eq!(page.blocks[0].order(), 0);
        assert_eq!(page.blocks[1].order(), 1);
        assert_eq!(page.blocks[2].order(), 2);
    }

    #[test]
    fn default_editor_preferences() {
        let prefs = EditorPreferences::default();
        assert_eq!(prefs.mode, EditorMode::RichText);
        assert!(!prefs.split_view);
    }

    #[test]
    fn test_rename_page_validation() {
        let mut page = Page::new(SectionId::new(), "Original").unwrap();
        let err = page.rename("").unwrap_err();
        assert!(matches!(err, CoreError::Validation { .. }));

        let err = page.rename("   ").unwrap_err();
        assert!(matches!(err, CoreError::Validation { .. }));

        assert_eq!(page.title, "Original");
    }

    #[test]
    fn test_rename_updates_timestamp() {
        let mut page = Page::new(SectionId::new(), "Old Title").unwrap();
        let created = page.created_at;
        std::thread::sleep(std::time::Duration::from_millis(2));

        page.rename("New Title").unwrap();
        assert!(page.updated_at > created);
        assert_eq!(page.title, "New Title");
    }

    #[test]
    fn test_add_tag_updates_timestamp() {
        let mut page = Page::new(SectionId::new(), "Test").unwrap();
        let before = page.updated_at;
        std::thread::sleep(std::time::Duration::from_millis(2));

        page.add_tag("estudo");
        assert!(page.updated_at > before);
    }

    #[test]
    fn test_add_tag_duplicate_does_not_update_timestamp() {
        let mut page = Page::new(SectionId::new(), "Test").unwrap();
        page.add_tag("rust");
        let after_first = page.updated_at;
        std::thread::sleep(std::time::Duration::from_millis(2));

        page.add_tag("RUST");
        assert_eq!(page.updated_at, after_first);
    }

    #[test]
    fn test_add_tag_empty_string_is_noop() {
        let mut page = Page::new(SectionId::new(), "Test").unwrap();
        let before = page.updated_at;

        page.add_tag("");
        page.add_tag("   ");

        assert_eq!(page.tags.len(), 0);
        assert_eq!(page.updated_at, before);
    }

    #[test]
    fn test_remove_tag_nonexistent_does_not_update_timestamp() {
        let mut page = Page::new(SectionId::new(), "Test").unwrap();
        let before = page.updated_at;

        let removed = page.remove_tag("inexistente");
        assert!(!removed);
        assert_eq!(page.updated_at, before);
    }

    #[test]
    fn test_add_block_updates_timestamp() {
        let mut page = Page::new(SectionId::new(), "Test").unwrap();
        let created = page.created_at;
        std::thread::sleep(std::time::Duration::from_millis(2));

        page.add_block(Block::new_divider(0)).unwrap();
        assert!(page.updated_at > created);
    }

    #[test]
    fn new_canvas_page_has_canvas_mode() {
        let page = Page::new_canvas(SectionId::new(), "Meu Canvas").unwrap();
        assert_eq!(page.editor_preferences.mode, EditorMode::Canvas);
        assert!(page.canvas_state.is_none());
        assert!(page.blocks.is_empty());
        assert!(page.pdf_asset.is_none());
    }

    #[test]
    fn new_canvas_rejects_empty_title() {
        assert!(Page::new_canvas(SectionId::new(), "").is_err());
        assert!(Page::new_canvas(SectionId::new(), "   ").is_err());
    }

    #[test]
    fn canvas_mode_serializes_as_snake_case() {
        let prefs = EditorPreferences {
            mode: EditorMode::Canvas,
            split_view: false,
        };
        let json = serde_json::to_value(&prefs).unwrap();
        assert_eq!(json["mode"], "canvas");
    }

    #[test]
    fn canvas_state_roundtrip() {
        let mut page = Page::new_canvas(SectionId::new(), "Test").unwrap();
        let state = serde_json::json!({
            "elements": [{ "type": "rectangle", "id": "abc" }],
            "appState": { "viewBackgroundColor": "#ffffff" },
            "files": {}
        });
        page.update_canvas_state(Some(state.clone()));
        let serialized = serde_json::to_string(&page).unwrap();
        let deserialized: Page = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized.canvas_state, Some(state));
    }

    #[test]
    fn existing_page_without_canvas_state_deserializes_ok() {
        // Simula um .opn.json antigo que não tem o campo canvas_state
        let json = serde_json::json!({
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "section_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
            "title": "Página antiga",
            "tags": [],
            "blocks": [],
            "annotations": { "strokes": [], "highlights": [], "svg_cache": null },
            "editor_preferences": { "mode": "rich_text", "split_view": false },
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
            "schema_version": 1
        });
        let page: Page = serde_json::from_value(json).unwrap();
        assert!(page.canvas_state.is_none()); // retrocompatibilidade OK
    }
}

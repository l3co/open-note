use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::id::BlockId;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct BlockBase {
    pub id: BlockId,
    pub order: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl BlockBase {
    pub fn new(order: u32) -> Self {
        let now = Utc::now();
        Self {
            id: BlockId::new(),
            order,
            created_at: now,
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Block {
    Text(TextBlock),
    Markdown(MarkdownBlock),
    Code(CodeBlock),
    Checklist(ChecklistBlock),
    Table(TableBlock),
    Image(ImageBlock),
    Ink(InkBlock),
    Pdf(PdfBlock),
    Divider(DividerBlock),
    Callout(CalloutBlock),
    Embed(EmbedBlock),
}

impl Block {
    pub fn base(&self) -> &BlockBase {
        match self {
            Block::Text(b) => &b.base,
            Block::Markdown(b) => &b.base,
            Block::Code(b) => &b.base,
            Block::Checklist(b) => &b.base,
            Block::Table(b) => &b.base,
            Block::Image(b) => &b.base,
            Block::Ink(b) => &b.base,
            Block::Pdf(b) => &b.base,
            Block::Divider(b) => &b.base,
            Block::Callout(b) => &b.base,
            Block::Embed(b) => &b.base,
        }
    }

    pub fn order(&self) -> u32 {
        self.base().order
    }

    pub fn id(&self) -> BlockId {
        self.base().id
    }

    pub fn new_text(order: u32, content: serde_json::Value) -> Self {
        Block::Text(TextBlock {
            base: BlockBase::new(order),
            content,
        })
    }

    pub fn new_divider(order: u32) -> Self {
        Block::Divider(DividerBlock {
            base: BlockBase::new(order),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct TextBlock {
    #[serde(flatten)]
    pub base: BlockBase,
    #[ts(type = "any")]
    pub content: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct MarkdownBlock {
    #[serde(flatten)]
    pub base: BlockBase,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct CodeBlock {
    #[serde(flatten)]
    pub base: BlockBase,
    pub language: Option<String>,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct ChecklistBlock {
    #[serde(flatten)]
    pub base: BlockBase,
    pub items: Vec<ChecklistItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct ChecklistItem {
    pub text: String,
    pub checked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct TableBlock {
    #[serde(flatten)]
    pub base: BlockBase,
    pub rows: Vec<Vec<String>>,
    pub has_header: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct ImageBlock {
    #[serde(flatten)]
    pub base: BlockBase,
    pub src: String,
    pub alt: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct InkBlock {
    #[serde(flatten)]
    pub base: BlockBase,
    #[ts(type = "any[]")]
    pub strokes: Vec<serde_json::Value>,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct PdfBlock {
    #[serde(flatten)]
    pub base: BlockBase,
    pub src: String,
    pub total_pages: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct DividerBlock {
    #[serde(flatten)]
    pub base: BlockBase,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct CalloutBlock {
    #[serde(flatten)]
    pub base: BlockBase,
    pub variant: CalloutVariant,
    pub content: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
#[serde(rename_all = "snake_case")]
pub enum CalloutVariant {
    Info,
    Warning,
    Error,
    Success,
    Tip,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct EmbedBlock {
    #[serde(flatten)]
    pub base: BlockBase,
    pub url: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub thumbnail: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_text_block_has_correct_order() {
        let block = Block::new_text(3, serde_json::json!({"text": "hello"}));
        assert_eq!(block.order(), 3);
    }

    #[test]
    fn new_divider_block() {
        let block = Block::new_divider(0);
        assert_eq!(block.order(), 0);
    }

    #[test]
    fn text_block_serializes_with_type_tag() {
        let block = Block::new_text(0, serde_json::json!({"text": "hello"}));
        let json = serde_json::to_value(&block).unwrap();
        assert_eq!(json["type"], "text");
    }

    #[test]
    fn divider_block_serializes_with_type_tag() {
        let block = Block::new_divider(1);
        let json = serde_json::to_value(&block).unwrap();
        assert_eq!(json["type"], "divider");
    }

    #[test]
    fn block_id_is_accessible() {
        let block = Block::new_text(0, serde_json::json!({}));
        assert!(!block.id().is_nil());
    }
}

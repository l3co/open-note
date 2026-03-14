use opennote_core::block::Block;
use opennote_core::page::Page;

pub fn extract_text_from_page(page: &Page) -> String {
    if page.protection.is_some() {
        return String::new();
    }
    page.blocks
        .iter()
        .filter_map(|block| {
            let text = extract_text_from_block(block);
            if text.is_empty() {
                None
            } else {
                Some(text)
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn extract_text_from_block(block: &Block) -> String {
    match block {
        Block::Text(b) => extract_text_from_tiptap_json(&b.content),
        Block::Markdown(b) => b.content.clone(),
        Block::Code(b) => b.content.clone(),
        Block::Checklist(b) => b
            .items
            .iter()
            .map(|i| i.text.clone())
            .collect::<Vec<_>>()
            .join(" "),
        Block::Table(b) => b
            .rows
            .iter()
            .flat_map(|row| row.iter().cloned())
            .collect::<Vec<_>>()
            .join(" "),
        Block::Image(b) => b.alt.clone().unwrap_or_default(),
        Block::Callout(b) => b.content.clone(),
        Block::Embed(b) => {
            let title = b.title.clone().unwrap_or_default();
            format!("{} {}", title, b.url).trim().to_string()
        }
        Block::Ink(_) | Block::Divider(_) | Block::Pdf(_) => String::new(),
    }
}

pub fn extract_text_from_tiptap_json(value: &serde_json::Value) -> String {
    let mut parts = Vec::new();
    if let Some(inner) = value.get("tiptap_json") {
        collect_text_recursive(inner, &mut parts);
    } else {
        collect_text_recursive(value, &mut parts);
    }
    parts.join(" ")
}

fn collect_text_recursive(value: &serde_json::Value, parts: &mut Vec<String>) {
    match value {
        serde_json::Value::Object(obj) => {
            if let Some(serde_json::Value::String(text)) = obj.get("text") {
                if !text.trim().is_empty() {
                    parts.push(text.clone());
                }
            }
            if let Some(content) = obj.get("content") {
                collect_text_recursive(content, parts);
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr {
                collect_text_recursive(item, parts);
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_from_empty_page() {
        let page = Page::new(opennote_core::id::SectionId::new(), "Test").unwrap();
        assert_eq!(extract_text_from_page(&page), "");
    }

    #[test]
    fn extract_from_text_block() {
        let json = serde_json::json!({
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        { "type": "text", "text": "Hello world" }
                    ]
                }
            ]
        });
        let block = Block::new_text(0, json);
        let mut page = Page::new(opennote_core::id::SectionId::new(), "Test").unwrap();
        page.add_block(block).unwrap();
        assert_eq!(extract_text_from_page(&page), "Hello world");
    }

    #[test]
    fn extract_from_nested_tiptap_json() {
        let json = serde_json::json!({
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        { "type": "text", "text": "Line one" },
                        { "type": "text", "text": "and more" }
                    ]
                },
                {
                    "type": "heading",
                    "attrs": { "level": 1 },
                    "content": [
                        { "type": "text", "text": "Title" }
                    ]
                }
            ]
        });
        let result = extract_text_from_tiptap_json(&json);
        assert!(result.contains("Line one"));
        assert!(result.contains("and more"));
        assert!(result.contains("Title"));
    }

    #[test]
    fn extract_from_divider_is_empty() {
        let block = Block::new_divider(0);
        assert_eq!(extract_text_from_block(&block), "");
    }

    #[test]
    fn extract_from_markdown_block() {
        use opennote_core::block::{BlockBase, MarkdownBlock};
        let block = Block::Markdown(MarkdownBlock {
            base: BlockBase::new(0),
            content: "# Hello\nworld".to_string(),
        });
        let text = extract_text_from_block(&block);
        assert!(text.contains("Hello"));
        assert!(text.contains("world"));
    }

    #[test]
    fn extract_from_code_block() {
        use opennote_core::block::{BlockBase, CodeBlock};
        let block = Block::Code(CodeBlock {
            base: BlockBase::new(0),
            language: Some("rust".to_string()),
            content: "println!(\"hello\");".to_string(),
        });
        let text = extract_text_from_block(&block);
        assert!(text.contains("println!"));
    }

    #[test]
    fn extract_from_checklist_block() {
        use opennote_core::block::{BlockBase, ChecklistBlock, ChecklistItem};
        let block = Block::Checklist(ChecklistBlock {
            base: BlockBase::new(0),
            items: vec![
                ChecklistItem { text: "Buy milk".to_string(), checked: false },
                ChecklistItem { text: "Buy eggs".to_string(), checked: true },
            ],
        });
        let text = extract_text_from_block(&block);
        assert!(text.contains("Buy milk"));
        assert!(text.contains("Buy eggs"));
    }

    #[test]
    fn extract_from_table_block() {
        use opennote_core::block::{BlockBase, TableBlock};
        let block = Block::Table(TableBlock {
            base: BlockBase::new(0),
            rows: vec![
                vec!["Header1".to_string(), "Header2".to_string()],
                vec!["Val1".to_string(), "Val2".to_string()],
            ],
            has_header: true,
        });
        let text = extract_text_from_block(&block);
        assert!(text.contains("Header1"));
        assert!(text.contains("Val2"));
    }

    #[test]
    fn extract_from_image_block_with_alt() {
        use opennote_core::block::{BlockBase, ImageBlock};
        let block = Block::Image(ImageBlock {
            base: BlockBase::new(0),
            src: "path/to/img.png".to_string(),
            alt: Some("A beautiful photo".to_string()),
            width: None,
            height: None,
        });
        let text = extract_text_from_block(&block);
        assert_eq!(text, "A beautiful photo");
    }

    #[test]
    fn extract_from_image_block_without_alt_is_empty() {
        use opennote_core::block::{BlockBase, ImageBlock};
        let block = Block::Image(ImageBlock {
            base: BlockBase::new(0),
            src: "path/to/img.png".to_string(),
            alt: None,
            width: None,
            height: None,
        });
        assert_eq!(extract_text_from_block(&block), "");
    }

    #[test]
    fn extract_from_callout_block() {
        use opennote_core::block::{BlockBase, CalloutBlock, CalloutVariant};
        let block = Block::Callout(CalloutBlock {
            base: BlockBase::new(0),
            variant: CalloutVariant::Info,
            content: "This is important".to_string(),
        });
        assert_eq!(extract_text_from_block(&block), "This is important");
    }

    #[test]
    fn extract_from_embed_block_with_title() {
        use opennote_core::block::{BlockBase, EmbedBlock};
        let block = Block::Embed(EmbedBlock {
            base: BlockBase::new(0),
            url: "https://example.com".to_string(),
            title: Some("Example Site".to_string()),
            description: None,
            thumbnail: None,
        });
        let text = extract_text_from_block(&block);
        assert!(text.contains("Example Site"));
        assert!(text.contains("https://example.com"));
    }

    #[test]
    fn extract_from_embed_block_without_title() {
        use opennote_core::block::{BlockBase, EmbedBlock};
        let block = Block::Embed(EmbedBlock {
            base: BlockBase::new(0),
            url: "https://example.com".to_string(),
            title: None,
            description: None,
            thumbnail: None,
        });
        let text = extract_text_from_block(&block);
        assert_eq!(text, "https://example.com");
    }

    #[test]
    fn extract_from_ink_block_is_empty() {
        use opennote_core::block::{BlockBase, InkBlock};
        let block = Block::Ink(InkBlock {
            base: BlockBase::new(0),
            strokes: vec![],
            width: 800,
            height: 600,
        });
        assert_eq!(extract_text_from_block(&block), "");
    }

    #[test]
    fn extract_from_pdf_block_is_empty() {
        use opennote_core::block::{BlockBase, PdfBlock};
        let block = Block::Pdf(PdfBlock {
            base: BlockBase::new(0),
            src: "doc.pdf".to_string(),
            total_pages: 5,
        });
        assert_eq!(extract_text_from_block(&block), "");
    }

    #[test]
    fn extract_protected_page_returns_empty() {
        use opennote_core::page::{EncryptionAlgorithm, KdfParams, KeyDerivationFunction, PageProtection};
        let mut page = Page::new(opennote_core::id::SectionId::new(), "Secret").unwrap();
        page.protection = Some(PageProtection {
            algorithm: EncryptionAlgorithm::AesGcm256,
            kdf: KeyDerivationFunction::Argon2id,
            kdf_params: KdfParams::default(),
            salt: "salt".to_string(),
            nonce: "nonce".to_string(),
        });
        assert_eq!(extract_text_from_page(&page), "");
    }

    #[test]
    fn extract_from_tiptap_json_with_wrapper_key() {
        let json = serde_json::json!({
            "tiptap_json": {
                "type": "doc",
                "content": [
                    { "type": "text", "text": "Wrapped content" }
                ]
            }
        });
        let result = extract_text_from_tiptap_json(&json);
        assert!(result.contains("Wrapped content"));
    }

    #[test]
    fn collect_text_skips_whitespace_only_nodes() {
        let json = serde_json::json!({
            "type": "doc",
            "content": [
                { "type": "text", "text": "   " },
                { "type": "text", "text": "Real content" }
            ]
        });
        let result = extract_text_from_tiptap_json(&json);
        assert!(!result.trim().starts_with(' '));
        assert!(result.contains("Real content"));
    }

    #[test]
    fn extract_multiple_blocks_joined_by_newline() {
        use opennote_core::block::{BlockBase, MarkdownBlock, CodeBlock};
        let mut page = Page::new(opennote_core::id::SectionId::new(), "Multi").unwrap();
        page.add_block(Block::Markdown(MarkdownBlock {
            base: BlockBase::new(0),
            content: "First block".to_string(),
        })).unwrap();
        page.add_block(Block::Code(CodeBlock {
            base: BlockBase::new(1),
            language: None,
            content: "Second block".to_string(),
        })).unwrap();
        let text = extract_text_from_page(&page);
        assert!(text.contains("First block"));
        assert!(text.contains("Second block"));
        assert!(text.contains('\n'));
    }
}

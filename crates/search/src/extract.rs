use opennote_core::block::Block;
use opennote_core::page::Page;

pub fn extract_text_from_page(page: &Page) -> String {
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
    collect_text_recursive(value, &mut parts);
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
}

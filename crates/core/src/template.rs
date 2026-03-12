use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::block::Block;
use crate::error::CoreError;
use crate::id::TemplateId;
use crate::page::EditorPreferences;

pub const CURRENT_TEMPLATE_SCHEMA_VERSION: u32 = 1;
pub const TEMPLATE_NAME_MAX_LEN: usize = 100;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
#[serde(rename_all = "snake_case")]
pub enum TemplateCategory {
    Meeting,
    Journal,
    Project,
    Study,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct NoteTemplate {
    pub id: TemplateId,
    pub name: String,
    pub description: Option<String>,
    pub category: TemplateCategory,
    pub icon: Option<String>,
    /// Título sugerido ao criar page. Suporta placeholder {{date}}.
    pub title_template: String,
    pub tags: Vec<String>,
    pub blocks: Vec<Block>,
    pub editor_preferences: EditorPreferences,
    pub is_builtin: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub schema_version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct TemplateSummary {
    pub id: TemplateId,
    pub name: String,
    pub description: Option<String>,
    pub category: TemplateCategory,
    pub icon: Option<String>,
    pub title_template: String,
    pub is_builtin: bool,
    pub block_count: usize,
    pub created_at: DateTime<Utc>,
}

impl From<&NoteTemplate> for TemplateSummary {
    fn from(t: &NoteTemplate) -> Self {
        Self {
            id: t.id,
            name: t.name.clone(),
            description: t.description.clone(),
            category: t.category.clone(),
            icon: t.icon.clone(),
            title_template: t.title_template.clone(),
            is_builtin: t.is_builtin,
            block_count: t.blocks.len(),
            created_at: t.created_at,
        }
    }
}

impl NoteTemplate {
    pub fn new(
        name: &str,
        category: TemplateCategory,
        title_template: &str,
    ) -> Result<Self, CoreError> {
        let name = name.trim().to_string();
        if name.is_empty() {
            return Err(CoreError::Validation {
                message: "Template name cannot be empty".to_string(),
            });
        }
        if name.len() > TEMPLATE_NAME_MAX_LEN {
            return Err(CoreError::Validation {
                message: format!("Template name exceeds {TEMPLATE_NAME_MAX_LEN} characters"),
            });
        }
        let title_template = title_template.trim().to_string();
        if title_template.is_empty() {
            return Err(CoreError::Validation {
                message: "Template title_template cannot be empty".to_string(),
            });
        }
        let now = Utc::now();
        Ok(Self {
            id: TemplateId::new(),
            name,
            description: None,
            category,
            icon: None,
            title_template,
            tags: vec![],
            blocks: vec![],
            editor_preferences: EditorPreferences::default(),
            is_builtin: false,
            created_at: now,
            updated_at: now,
            schema_version: CURRENT_TEMPLATE_SCHEMA_VERSION,
        })
    }

    /// Resolve placeholders no título: {{date}} → data atual em formato ISO (YYYY-MM-DD).
    pub fn resolve_title(&self) -> String {
        let today = Utc::now().format("%Y-%m-%d").to_string();
        self.title_template.replace("{{date}}", &today)
    }

    /// Valida que nenhum bloco é do tipo ImageBlock (restrição v1).
    pub fn validate_no_image_blocks(&self) -> Result<(), CoreError> {
        for block in &self.blocks {
            if matches!(block, crate::block::Block::Image(_)) {
                return Err(CoreError::Validation {
                    message: "Templates with ImageBlock are not supported in v1. \
                              Remove image blocks before saving as template."
                        .to_string(),
                });
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::block::Block;

    #[test]
    fn create_template_valid() {
        let template =
            NoteTemplate::new("Meeting", TemplateCategory::Meeting, "Reunião {{date}}").unwrap();
        assert_eq!(template.name, "Meeting");
        assert_eq!(template.title_template, "Reunião {{date}}");
        assert!(!template.is_builtin);
    }

    #[test]
    fn reject_empty_name() {
        let res = NoteTemplate::new("", TemplateCategory::Custom, "Title");
        assert!(matches!(res, Err(CoreError::Validation { .. })));
    }

    #[test]
    fn reject_name_too_long() {
        let long_name = "a".repeat(TEMPLATE_NAME_MAX_LEN + 1);
        let res = NoteTemplate::new(&long_name, TemplateCategory::Custom, "Title");
        assert!(matches!(res, Err(CoreError::Validation { .. })));
    }

    #[test]
    fn reject_empty_title_template() {
        let res = NoteTemplate::new("Name", TemplateCategory::Custom, "");
        assert!(matches!(res, Err(CoreError::Validation { .. })));
    }

    #[test]
    fn resolve_title_with_date() {
        let template = NoteTemplate::new("Name", TemplateCategory::Custom, "Doc {{date}}").unwrap();
        let resolved = template.resolve_title();
        let today = Utc::now().format("%Y-%m-%d").to_string();
        assert_eq!(resolved, format!("Doc {today}"));
    }

    #[test]
    fn resolve_title_without_placeholder() {
        let template = NoteTemplate::new("Name", TemplateCategory::Custom, "Static Title").unwrap();
        assert_eq!(template.resolve_title(), "Static Title");
    }

    #[test]
    fn validate_no_image_blocks_passes() {
        let mut template = NoteTemplate::new("Name", TemplateCategory::Custom, "Title").unwrap();
        template.blocks.push(Block::new_divider(0));
        assert!(template.validate_no_image_blocks().is_ok());
    }

    #[test]
    fn validate_no_image_blocks_fails() {
        let mut template = NoteTemplate::new("Name", TemplateCategory::Custom, "Title").unwrap();
        template.blocks.push(Block::Image(crate::block::ImageBlock {
            base: crate::block::BlockBase::new(0),
            src: "path.png".to_string(),
            alt: None,
            width: None,
            height: None,
        }));
        let res = template.validate_no_image_blocks();
        assert!(matches!(res, Err(CoreError::Validation { .. })));
    }

    #[test]
    fn template_summary_from_template() {
        let template = NoteTemplate::new("Name", TemplateCategory::Project, "Title").unwrap();
        let summary = TemplateSummary::from(&template);
        assert_eq!(summary.name, "Name");
        assert_eq!(summary.category, TemplateCategory::Project);
        assert_eq!(summary.block_count, 0);
    }
}

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::color::Color;
use crate::error::CoreError;
use crate::id::{NotebookId, SectionId};

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct Section {
    pub id: SectionId,
    pub notebook_id: NotebookId,
    pub name: String,
    pub color: Option<Color>,
    pub order: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Section {
    pub fn new(notebook_id: NotebookId, name: &str, order: u32) -> Result<Self, CoreError> {
        let name = name.trim().to_string();
        if name.is_empty() {
            return Err(CoreError::Validation {
                message: "Section name cannot be empty".to_string(),
            });
        }

        let now = Utc::now();
        Ok(Self {
            id: SectionId::new(),
            notebook_id,
            name,
            color: None,
            order,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn rename(&mut self, new_name: &str) -> Result<(), CoreError> {
        let new_name = new_name.trim().to_string();
        if new_name.is_empty() {
            return Err(CoreError::Validation {
                message: "Section name cannot be empty".to_string(),
            });
        }
        self.name = new_name;
        self.updated_at = Utc::now();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_section_with_valid_name() {
        let nb_id = NotebookId::new();
        let sec = Section::new(nb_id, "Estudos", 0).unwrap();
        assert_eq!(sec.name, "Estudos");
        assert_eq!(sec.notebook_id, nb_id);
    }

    #[test]
    fn reject_empty_section_name() {
        assert!(Section::new(NotebookId::new(), "", 0).is_err());
    }

    #[test]
    fn rename_section() {
        let mut sec = Section::new(NotebookId::new(), "Old", 0).unwrap();
        sec.rename("New").unwrap();
        assert_eq!(sec.name, "New");
    }

    #[test]
    fn test_section_validation_empty_name() {
        let err = Section::new(NotebookId::new(), "", 0).unwrap_err();
        assert!(matches!(err, CoreError::Validation { .. }));

        let err = Section::new(NotebookId::new(), "   ", 0).unwrap_err();
        assert!(matches!(err, CoreError::Validation { .. }));
    }
}

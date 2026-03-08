use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::color::Color;
use crate::error::CoreError;
use crate::id::NotebookId;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct Notebook {
    pub id: NotebookId,
    pub name: String,
    pub color: Option<Color>,
    pub icon: Option<String>,
    pub order: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Notebook {
    pub fn new(name: &str, order: u32) -> Result<Self, CoreError> {
        let name = name.trim().to_string();
        if name.is_empty() {
            return Err(CoreError::Validation {
                message: "Notebook name cannot be empty".to_string(),
            });
        }

        let now = Utc::now();
        Ok(Self {
            id: NotebookId::new(),
            name,
            color: None,
            icon: None,
            order,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn rename(&mut self, new_name: &str) -> Result<(), CoreError> {
        let new_name = new_name.trim().to_string();
        if new_name.is_empty() {
            return Err(CoreError::Validation {
                message: "Notebook name cannot be empty".to_string(),
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
    fn create_notebook_with_valid_name() {
        let nb = Notebook::new("Estudos", 0).unwrap();
        assert_eq!(nb.name, "Estudos");
        assert_eq!(nb.order, 0);
        assert!(!nb.id.is_nil());
    }

    #[test]
    fn reject_empty_notebook_name() {
        assert!(Notebook::new("", 0).is_err());
        assert!(Notebook::new("   ", 0).is_err());
    }

    #[test]
    fn rename_notebook() {
        let mut nb = Notebook::new("Old", 0).unwrap();
        nb.rename("New Name").unwrap();
        assert_eq!(nb.name, "New Name");
    }

    #[test]
    fn reject_rename_to_empty() {
        let mut nb = Notebook::new("Valid", 0).unwrap();
        assert!(nb.rename("").is_err());
    }

    #[test]
    fn test_notebook_rename_trims_whitespace() {
        let mut nb = Notebook::new("Old", 0).unwrap();
        nb.rename("  Novo  ").unwrap();
        assert_eq!(nb.name, "Novo");
    }
}

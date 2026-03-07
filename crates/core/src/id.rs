use serde::{Deserialize, Serialize};
use std::fmt;
use ts_rs::TS;
use uuid::Uuid;

macro_rules! define_id {
    ($name:ident) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
        #[ts(export, export_to = "../../../src/types/bindings/")]
        pub struct $name(Uuid);

        impl $name {
            pub fn new() -> Self {
                Self(Uuid::new_v4())
            }

            pub fn from_uuid(uuid: Uuid) -> Self {
                Self(uuid)
            }

            pub fn as_uuid(&self) -> &Uuid {
                &self.0
            }

            pub fn is_nil(&self) -> bool {
                self.0.is_nil()
            }
        }

        impl Default for $name {
            fn default() -> Self {
                Self::new()
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(f, "{}", self.0)
            }
        }

        impl From<Uuid> for $name {
            fn from(uuid: Uuid) -> Self {
                Self(uuid)
            }
        }
    };
}

define_id!(WorkspaceId);
define_id!(NotebookId);
define_id!(SectionId);
define_id!(PageId);
define_id!(BlockId);
define_id!(StrokeId);
define_id!(AnnotationId);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_id_is_not_nil() {
        let id = PageId::new();
        assert!(!id.is_nil());
    }

    #[test]
    fn two_ids_are_different() {
        let a = NotebookId::new();
        let b = NotebookId::new();
        assert_ne!(a, b);
    }

    #[test]
    fn id_display_matches_uuid() {
        let uuid = Uuid::new_v4();
        let id = SectionId::from_uuid(uuid);
        assert_eq!(id.to_string(), uuid.to_string());
    }

    #[test]
    fn id_serializes_as_uuid_string() {
        let id = BlockId::new();
        let json = serde_json::to_string(&id).unwrap();
        assert!(json.starts_with('"'));
        assert!(json.ends_with('"'));
    }
}

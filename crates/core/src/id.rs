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
define_id!(TemplateId);

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

    #[test]
    fn test_id_type_safety_across_newtypes() {
        use std::any::TypeId;
        assert_ne!(TypeId::of::<PageId>(), TypeId::of::<NotebookId>());
        assert_ne!(TypeId::of::<PageId>(), TypeId::of::<SectionId>());
        assert_ne!(TypeId::of::<NotebookId>(), TypeId::of::<SectionId>());
        assert_ne!(TypeId::of::<BlockId>(), TypeId::of::<StrokeId>());
    }

    #[test]
    fn test_id_parse_from_string() {
        let uuid = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        let page_id = PageId::from_uuid(uuid);
        assert_eq!(page_id.to_string(), "550e8400-e29b-41d4-a716-446655440000");

        let json_valid = r#""550e8400-e29b-41d4-a716-446655440000""#;
        let parsed: PageId = serde_json::from_str(json_valid).unwrap();
        assert_eq!(parsed, page_id);

        let json_invalid = r#""not-a-uuid""#;
        let result: Result<PageId, _> = serde_json::from_str(json_invalid);
        assert!(result.is_err());
    }
}

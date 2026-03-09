use serde::Serialize;

/// Structured command errors serialized to the frontend.
#[derive(Debug, Serialize)]
#[serde(tag = "code", content = "message")]
pub enum CommandError {
    NoWorkspace,
    WorkspaceNotFound(String),
    NotFound(String),
    Validation(String),
    Storage(String),
    Internal(String),
}

impl std::fmt::Display for CommandError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NoWorkspace => write!(f, "No workspace is currently open"),
            Self::WorkspaceNotFound(id) => write!(f, "Workspace {id} is not open"),
            Self::NotFound(message) => write!(f, "Not found: {message}"),
            Self::Validation(message) => write!(f, "Validation error: {message}"),
            Self::Storage(message) => write!(f, "Storage error: {message}"),
            Self::Internal(message) => write!(f, "Internal error: {message}"),
        }
    }
}

impl std::error::Error for CommandError {}

impl From<opennote_storage::error::StorageError> for CommandError {
    fn from(error: opennote_storage::error::StorageError) -> Self {
        use opennote_storage::error::StorageError;

        match error {
            StorageError::PageNotFound { id } => Self::NotFound(format!("Page {id}")),
            StorageError::NotebookNotFound { name } => Self::NotFound(format!("Notebook {name}")),
            StorageError::SectionNotFound { name } => Self::NotFound(format!("Section {name}")),
            StorageError::WorkspaceNotFound { path } => {
                Self::NotFound(format!("Workspace at {}", path.display()))
            }
            StorageError::Io { source } => Self::Storage(source.to_string()),
            StorageError::Serialization { source } => Self::Internal(source.to_string()),
            StorageError::Core { source } => Self::from(source),
            other => Self::Internal(other.to_string()),
        }
    }
}

impl From<opennote_core::error::CoreError> for CommandError {
    fn from(error: opennote_core::error::CoreError) -> Self {
        use opennote_core::error::CoreError;

        match error {
            CoreError::Validation { message } => Self::Validation(message),
            CoreError::NotFound { entity, id } => Self::NotFound(format!("{entity} {id}")),
            CoreError::LimitExceeded { message } => Self::Validation(message),
            CoreError::Internal { message } => Self::Internal(message),
        }
    }
}

impl From<opennote_search::error::SearchError> for CommandError {
    fn from(error: opennote_search::error::SearchError) -> Self {
        Self::Internal(error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use opennote_core::id::PageId;

    #[test]
    fn command_error_serializes_with_type_tag() {
        let error = CommandError::NotFound("Page abc".into());
        let json = serde_json::to_string(&error).expect("error should serialize");

        assert!(json.contains("\"code\":\"NotFound\""));
    }

    #[test]
    fn storage_error_converts_to_command_error() {
        use opennote_storage::error::StorageError;

        let storage_error = StorageError::PageNotFound { id: PageId::new() };
        let command_error: CommandError = storage_error.into();

        assert!(matches!(command_error, CommandError::NotFound(_)));
    }
}

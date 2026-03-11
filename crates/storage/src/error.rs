use std::path::PathBuf;

use opennote_core::id::PageId;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("Workspace not found: {path}")]
    WorkspaceNotFound { path: PathBuf },

    #[error("Notebook already exists: {name}")]
    NotebookAlreadyExists { name: String },

    #[error("Notebook not found: {name}")]
    NotebookNotFound { name: String },

    #[error("Section already exists: {name}")]
    SectionAlreadyExists { name: String },

    #[error("Section not found: {name}")]
    SectionNotFound { name: String },

    #[error("Page not found: {id}")]
    PageNotFound { id: PageId },

    #[error("Schema version mismatch: expected {expected}, found {found}")]
    SchemaVersionMismatch { expected: u32, found: u32 },

    #[error("Workspace is locked by another process (PID {pid})")]
    WorkspaceLocked { pid: u32 },

    #[error("Trash item not found: {id}")]
    TrashItemNotFound { id: String },

    #[error("Encryption error: {0}")]
    EncryptionError(String),

    #[error("Wrong password")]
    WrongPassword,

    #[error("I/O error: {source}")]
    Io {
        #[from]
        source: std::io::Error,
    },

    #[error("Serialization error: {source}")]
    Serialization {
        #[from]
        source: serde_json::Error,
    },

    #[error("Core error: {source}")]
    Core {
        #[from]
        source: opennote_core::error::CoreError,
    },
}

pub type StorageResult<T> = Result<T, StorageError>;

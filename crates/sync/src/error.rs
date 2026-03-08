use thiserror::Error;

#[derive(Debug, Error)]
pub enum SyncError {
    #[error("Authentication required: {provider}")]
    AuthRequired { provider: String },

    #[error("Authentication failed: {message}")]
    AuthFailed { message: String },

    #[error("Token expired for provider: {provider}")]
    TokenExpired { provider: String },

    #[error("Provider not found: {provider}")]
    ProviderNotFound { provider: String },

    #[error("Network error: {0}")]
    Network(String),

    #[error("API error: {status} — {message}")]
    Api { status: u16, message: String },

    #[error("Rate limited, retry after {retry_after_secs}s")]
    RateLimited { retry_after_secs: u64 },

    #[error("Conflict on file: {path}")]
    Conflict { path: String },

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Sync not configured")]
    NotConfigured,

    #[error("Sync already in progress")]
    AlreadyInProgress,
}

pub type SyncResult<T> = Result<T, SyncError>;

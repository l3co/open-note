use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("Validation error: {message}")]
    Validation { message: String },

    #[error("Entity not found: {entity} with id {id}")]
    NotFound { entity: String, id: String },

    #[error("Limit exceeded: {message}")]
    LimitExceeded { message: String },

    #[error("Internal error: {message}")]
    Internal { message: String },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validation_error_displays_message() {
        let err = CoreError::Validation {
            message: "Name cannot be empty".to_string(),
        };
        assert_eq!(err.to_string(), "Validation error: Name cannot be empty");
    }

    #[test]
    fn limit_exceeded_error_displays_message() {
        let err = CoreError::LimitExceeded {
            message: "Page block limit reached".to_string(),
        };
        assert_eq!(err.to_string(), "Limit exceeded: Page block limit reached");
    }

    #[test]
    fn internal_error_displays_message() {
        let err = CoreError::Internal {
            message: "Unexpected state".to_string(),
        };
        assert_eq!(err.to_string(), "Internal error: Unexpected state");
    }
}

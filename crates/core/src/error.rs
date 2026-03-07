use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("Validation error: {message}")]
    Validation { message: String },

    #[error("Entity not found: {entity} with id {id}")]
    NotFound { entity: String, id: String },
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
}

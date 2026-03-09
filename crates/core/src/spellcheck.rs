use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SpellCheckRequest {
    pub text: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SpellCheckMatch {
    pub message: String,
    pub offset: usize,
    pub length: usize,
    pub replacements: Vec<String>,
    pub rule_id: String,
    pub rule_description: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SpellCheckResponse {
    pub matches: Vec<SpellCheckMatch>,
    pub language: String,
}

impl SpellCheckRequest {
    pub fn new(text: impl Into<String>, language: impl Into<String>) -> Self {
        Self {
            text: text.into(),
            language: language.into(),
        }
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.text.is_empty() {
            return Err("Text cannot be empty".to_string());
        }
        if self.language.is_empty() {
            return Err("Language cannot be empty".to_string());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spell_check_request_new() {
        let req = SpellCheckRequest::new("Hello", "en");
        assert_eq!(req.text, "Hello");
        assert_eq!(req.language, "en");
    }

    #[test]
    fn validate_rejects_empty_text() {
        let req = SpellCheckRequest::new("", "en");
        assert!(req.validate().is_err());
    }

    #[test]
    fn validate_rejects_empty_language() {
        let req = SpellCheckRequest::new("Hello", "");
        assert!(req.validate().is_err());
    }

    #[test]
    fn validate_accepts_valid_request() {
        let req = SpellCheckRequest::new("Hello world", "en-US");
        assert!(req.validate().is_ok());
    }

    #[test]
    fn spell_check_match_serializes() {
        let m = SpellCheckMatch {
            message: "Possible typo".to_string(),
            offset: 0,
            length: 5,
            replacements: vec!["Hello".to_string()],
            rule_id: "MORFOLOGIK_RULE".to_string(),
            rule_description: "Possible spelling mistake".to_string(),
            category: "TYPOS".to_string(),
        };
        let json = serde_json::to_string(&m).unwrap();
        assert!(json.contains("Possible typo"));
    }
}

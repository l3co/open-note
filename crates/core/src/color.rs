use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::error::CoreError;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct Color {
    hex: String,
}

impl Color {
    pub fn new(hex: &str) -> Result<Self, CoreError> {
        let hex = if hex.starts_with('#') {
            hex.to_string()
        } else {
            format!("#{hex}")
        };

        if !Self::is_valid_hex(&hex) {
            return Err(CoreError::Validation {
                message: format!("Invalid hex color: {hex}"),
            });
        }

        Ok(Self { hex })
    }

    pub fn hex(&self) -> &str {
        &self.hex
    }

    fn is_valid_hex(hex: &str) -> bool {
        if !hex.starts_with('#') {
            return false;
        }
        let digits = &hex[1..];
        (digits.len() == 6 || digits.len() == 3) && digits.chars().all(|c| c.is_ascii_hexdigit())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_hex_with_hash() {
        let c = Color::new("#ff5733").unwrap();
        assert_eq!(c.hex(), "#ff5733");
    }

    #[test]
    fn valid_hex_without_hash() {
        let c = Color::new("ff5733").unwrap();
        assert_eq!(c.hex(), "#ff5733");
    }

    #[test]
    fn valid_short_hex() {
        let c = Color::new("#abc").unwrap();
        assert_eq!(c.hex(), "#abc");
    }

    #[test]
    fn invalid_hex_rejected() {
        assert!(Color::new("#xyz").is_err());
        assert!(Color::new("#12345").is_err());
        assert!(Color::new("").is_err());
    }
}

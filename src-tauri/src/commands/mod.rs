pub mod assets;
pub mod notebook;
pub mod page;
pub mod search;
pub mod section;
pub mod sync;
pub mod tags;
pub mod trash;
pub mod workspace;

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
}

#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: "Open Note".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_app_info_returns_correct_name() {
        let info = get_app_info();
        assert_eq!(info.name, "Open Note");
    }

    #[test]
    fn get_app_info_returns_valid_version() {
        let info = get_app_info();
        assert!(!info.version.is_empty());
    }
}

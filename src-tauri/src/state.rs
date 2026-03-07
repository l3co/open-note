use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppManagedState {
    pub workspace_root: Mutex<Option<PathBuf>>,
}

impl AppManagedState {
    pub fn new() -> Self {
        Self {
            workspace_root: Mutex::new(None),
        }
    }

    pub fn get_workspace_root(&self) -> Result<PathBuf, String> {
        self.workspace_root
            .lock()
            .map_err(|e| format!("Lock error: {e}"))?
            .clone()
            .ok_or_else(|| "No workspace is currently open".to_string())
    }

    pub fn set_workspace_root(&self, path: Option<PathBuf>) -> Result<(), String> {
        let mut root = self
            .workspace_root
            .lock()
            .map_err(|e| format!("Lock error: {e}"))?;
        *root = path;
        Ok(())
    }
}

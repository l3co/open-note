use std::fs;
use std::path::Path;

fn main() {
    // Load .env.local from the workspace root so that option_env!("GOOGLE_CLIENT_ID")
    // etc. resolve at compile time in this crate's provider modules.
    let env_path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join(".env.local");

    if let Ok(content) = fs::read_to_string(&env_path) {
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((key, value)) = line.split_once('=') {
                let key = key.trim();
                let value = value.trim().trim_matches('"').trim_matches('\'');
                if !key.is_empty() {
                    println!("cargo:rustc-env={key}={value}");
                }
            }
        }
    }

    println!("cargo:rerun-if-changed={}", env_path.display());
}

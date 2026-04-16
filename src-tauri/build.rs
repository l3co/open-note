use std::fs;
use std::path::Path;

fn main() {
    // Load .env.local from the workspace root (one level above src-tauri/) so that
    // option_env!("GOOGLE_CLIENT_ID") etc. are resolved at compile time.
    // This allows `cargo tauri build` to embed credentials without requiring the
    // environment to be set externally.
    let env_path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join(".env.local");

    if let Ok(content) = fs::read_to_string(&env_path) {
        for line in content.lines() {
            let line = line.trim();
            // Skip comments and empty lines.
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((key, value)) = line.split_once('=') {
                let key = key.trim();
                // Strip surrounding quotes from the value if present.
                let value = value.trim().trim_matches('"').trim_matches('\'');
                if !key.is_empty() {
                    println!("cargo:rustc-env={key}={value}");
                }
            }
        }
    }

    // Re-run this build script whenever .env.local changes.
    println!("cargo:rerun-if-changed={}", env_path.display());

    tauri_build::build()
}

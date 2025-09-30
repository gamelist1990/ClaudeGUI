#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Initialize logging and open devtools in debug so we can inspect WebView console
// and catch frontend errors that cause a blank screen.
use tracing_subscriber;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize tracing subscriber from the environment if available. Ignore errors
    // so this is safe in production where a global subscriber may already exist.
    let _ = tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .try_init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

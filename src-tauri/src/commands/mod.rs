#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Cekcok Kroma Rust engine!", name)
}

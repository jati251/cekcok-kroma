use std::process::Command;

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Cekcok Kroma Rust engine!", name)
}

#[derive(serde::Serialize)]
pub struct VideoMetadata {
    pub duration: f64,
}

#[tauri::command]
pub fn get_video_metadata(path: &str) -> Result<VideoMetadata, String> {
    let output = Command::new("ffprobe")
        .args([
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            path
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("Failed to extract metadata using ffprobe".to_string());
    }

    let duration_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let duration: f64 = duration_str.parse().unwrap_or(0.0);

    Ok(VideoMetadata { duration })
}

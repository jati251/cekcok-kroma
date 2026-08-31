use std::process::Command;

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Cekcok Kroma Rust engine!", name)
}

#[derive(serde::Serialize)]
pub struct VideoMetadata {
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub has_audio: bool,
}

#[tauri::command]
pub fn get_video_metadata(path: &str) -> Result<VideoMetadata, String> {
    // Probe format duration
    let duration_output = Command::new("ffprobe")
        .args([
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            path
        ])
        .output()
        .map_err(|e| e.to_string())?;

    let duration: f64 = if duration_output.status.success() {
        String::from_utf8_lossy(&duration_output.stdout)
            .trim()
            .parse()
            .unwrap_or(10.0)
    } else {
        10.0
    };

    // Probe video stream dimensions (width, height)
    let stream_output = Command::new("ffprobe")
        .args([
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-of", "csv=s=x:p=0",
            path
        ])
        .output();

    let mut width = 1920;
    let mut height = 1080;
    if let Ok(out) = stream_output {
        if out.status.success() {
            let dim_str = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let parts: Vec<&str> = dim_str.split('x').collect();
            if parts.len() == 2 {
                width = parts[0].parse().unwrap_or(1920);
                height = parts[1].parse().unwrap_or(1080);
            }
        }
    }

    // Check if audio stream exists
    let audio_output = Command::new("ffprobe")
        .args([
            "-v", "error",
            "-select_streams", "a",
            "-show_entries", "stream=codec_type",
            "-of", "default=noprint_wrappers=1:nokey=1",
            path
        ])
        .output();

    let has_audio = match audio_output {
        Ok(out) => out.status.success() && !out.stdout.is_empty(),
        Err(_) => true,
    };

    Ok(VideoMetadata {
        duration,
        width,
        height,
        has_audio,
    })
}

#[tauri::command]
pub fn get_audio_waveform(path: &str, points: usize) -> Result<Vec<f32>, String> {
    let target_points = if points == 0 { 100 } else { points };

    // Extract downsampled raw 16-bit PCM mono audio using ffmpeg with multi-threading
    let output = Command::new("ffmpeg")
        .args([
            "-threads", "0",
            "-i", path,
            "-vn",
            "-ac", "1",
            "-filter:a", "aresample=4000",
            "-f", "s16le",
            "-",
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() || output.stdout.is_empty() {
        // Fallback to generated subtle placeholder waveform
        let mut fallback = Vec::with_capacity(target_points);
        for i in 0..target_points {
            let v = ((i as f32 * 0.2).sin().abs() * 0.6 + 0.2).min(1.0);
            fallback.push(v);
        }
        return Ok(fallback);
    }

    let bytes = &output.stdout;
    let sample_count = bytes.len() / 2;
    if sample_count == 0 {
        return Ok(vec![0.1; target_points]);
    }

    let chunk_size = (sample_count / target_points).max(1);
    let mut waveform = Vec::with_capacity(target_points);

    for chunk_idx in 0..target_points {
        let start_sample = chunk_idx * chunk_size;
        let end_sample = ((chunk_idx + 1) * chunk_size).min(sample_count);

        let mut max_amp: i16 = 0;
        for s in start_sample..end_sample {
            let byte_idx = s * 2;
            if byte_idx + 1 < bytes.len() {
                let sample = i16::from_le_bytes([bytes[byte_idx], bytes[byte_idx + 1]]);
                let abs_val = sample.saturating_abs();
                if abs_val > max_amp {
                    max_amp = abs_val;
                }
            }
        }

        // Normalize 0.0 to 1.0
        let norm = (max_amp as f32 / 32767.0).clamp(0.05, 1.0);
        waveform.push(norm);
    }

    Ok(waveform)
}

#[tauri::command]
pub fn export_frame(path: &str, timestamp: f64, output_path: &str) -> Result<String, String> {
    let t_str = format!("{:.3}", timestamp.max(0.0));
    let output = Command::new("ffmpeg")
        .args([
            "-ss", &t_str,
            "-hwaccel", "auto",
            "-threads", "0",
            "-i", path,
            "-vframes", "1",
            "-q:v", "2",
            "-y",
            output_path
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("Failed to export frame with FFmpeg".to_string());
    }

    Ok(output_path.to_string())
}

#[tauri::command]
pub fn save_project(path: &str, data: &str) -> Result<(), String> {
    std::fs::write(path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_project(path: &str) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

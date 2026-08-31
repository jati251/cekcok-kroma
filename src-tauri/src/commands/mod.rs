use std::process::Command;
use tauri::State;
use crate::state::{AppState, DocumentState, DragItem, Track};
use crate::engine::overwrite::overwrite_clip;

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

#[tauri::command]
pub fn get_state(state: State<'_, AppState>) -> Result<DocumentState, String> {
    let doc = state.state.lock().map_err(|e| e.to_string())?;
    Ok(doc.clone())
}

#[tauri::command]
pub fn add_media_to_bin(item: DragItem, state: State<'_, AppState>) -> Result<DocumentState, String> {
    state.commit_history();
    let mut doc = state.state.lock().map_err(|e| e.to_string())?;
    doc.media_items.push(item);
    Ok(doc.clone())
}

#[tauri::command]
pub fn add_media_batch_to_bin(items: Vec<DragItem>, state: State<'_, AppState>) -> Result<DocumentState, String> {
    state.commit_history();
    let mut doc = state.state.lock().map_err(|e| e.to_string())?;
    doc.media_items.extend(items);
    Ok(doc.clone())
}

#[tauri::command]
pub fn drop_clip_to_timeline(
    track_id: String,
    video_clip: DragItem,
    audio_clip: Option<DragItem>,
    state: State<'_, AppState>
) -> Result<DocumentState, String> {
    state.commit_history();
    
    let mut doc = state.state.lock().map_err(|e| e.to_string())?;

    // Pre-clean: Remove the incoming clip IDs from anywhere they currently exist (for move/drag operations)
    let mut remove_ids = vec![video_clip.id.clone()];
    if let Some(ac) = &audio_clip {
        remove_ids.push(ac.id.clone());
    }
    
    for track in &mut doc.tracks {
        track.items.retain(|item| !remove_ids.contains(&item.id));
    }
    
    // Auto-Routing logic for NEW_VIDEO_TRACK and NEW_AUDIO_TRACK
    if track_id == "NEW_VIDEO_TRACK" {
        let v_count = doc.tracks.iter().filter(|t| t.r#type == "video").count();
        let new_track = Track {
            id: format!("V{}", v_count + 1),
            name: format!("V{}", v_count + 1),
            r#type: "video".to_string(),
            items: vec![video_clip.clone()],
            is_locked: Some(false),
            is_muted: Some(false),
        };
        doc.tracks.insert(0, new_track);
    } else if track_id == "NEW_AUDIO_TRACK" {
        let a_count = doc.tracks.iter().filter(|t| t.r#type == "audio").count();
        if let Some(ac) = &audio_clip {
            let new_track = Track {
                id: format!("A{}", a_count + 1),
                name: format!("A{}", a_count + 1),
                r#type: "audio".to_string(),
                items: vec![ac.clone()],
                is_locked: Some(false),
                is_muted: Some(false),
            };
            doc.tracks.push(new_track);
        }
    } else {
        // Standard drop with overwrite
        let mut audio_target_id = track_id.clone();
        if track_id.starts_with('v') || track_id.starts_with('V') {
            audio_target_id = track_id.replace('v', "a").replace('V', "A");
        }

        let has_audio_target = doc.tracks.iter().any(|t| t.id == audio_target_id);
        
        if !has_audio_target && (track_id.starts_with('v') || track_id.starts_with('V')) {
            doc.tracks.push(Track {
                id: audio_target_id.clone(),
                name: audio_target_id.to_uppercase(),
                r#type: "audio".to_string(),
                items: vec![],
                is_locked: Some(false),
                is_muted: Some(false),
            });
        }

        let mut next_tracks = Vec::new();
        for mut track in doc.tracks.drain(..) {
            if track.id == track_id && track.is_locked != Some(true) {
                if track.r#type == "video" {
                    track = overwrite_clip(track, video_clip.clone());
                } else if track.r#type == "audio" {
                    if let Some(ac) = &audio_clip {
                        track = overwrite_clip(track, ac.clone());
                    } else {
                        track = overwrite_clip(track, video_clip.clone());
                    }
                }
            }
            if track.id == audio_target_id && (track_id.starts_with('v') || track_id.starts_with('V')) && track.is_locked != Some(true) {
                if let Some(ac) = &audio_clip {
                    track = overwrite_clip(track, ac.clone());
                }
            }
            next_tracks.push(track);
        }
        doc.tracks = next_tracks;
    }

    Ok(doc.clone())
}

#[tauri::command]
pub fn delete_clip(clip_id: String, linked_selection: bool, state: State<'_, AppState>) -> Result<DocumentState, String> {
    state.commit_history();
    let mut doc = state.state.lock().map_err(|e| e.to_string())?;

    // First find the linked clip ID if linked selection is on
    let mut target_ids = vec![clip_id.clone()];
    
    if linked_selection {
        for track in &doc.tracks {
            if let Some(item) = track.items.iter().find(|i| i.id == clip_id) {
                if let Some(linked) = &item.linked_clip_id {
                    target_ids.push(linked.clone());
                }
                break;
            }
        }
    }

    for track in &mut doc.tracks {
        if track.is_locked != Some(true) {
            track.items.retain(|item| !target_ids.contains(&item.id));
        }
    }

    Ok(doc.clone())
}

#[tauri::command]
pub fn undo_action_cmd(state: State<'_, AppState>) -> Result<DocumentState, String> {
    if let Some(prev) = state.undo() {
        Ok(prev)
    } else {
        let doc = state.state.lock().unwrap();
        Ok(doc.clone())
    }
}

#[tauri::command]
pub fn redo_action_cmd(state: State<'_, AppState>) -> Result<DocumentState, String> {
    if let Some(next) = state.redo() {
        Ok(next)
    } else {
        let doc = state.state.lock().unwrap();
        Ok(doc.clone())
    }
}

#[tauri::command]
pub fn split_clip_cmd(
    clip_id: String,
    timestamp: f64,
    linked_selection: bool,
    state: State<'_, AppState>
) -> Result<DocumentState, String> {
    state.commit_history();
    let mut doc = state.state.lock().map_err(|e| e.to_string())?;

    let cut_time_str = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis().to_string();

    for track in &mut doc.tracks {
        if track.is_locked == Some(true) { continue; }

        let mut i = 0;
        while i < track.items.len() {
            let item = &track.items[i];
            let start = item.start.unwrap_or(0.0);
            let dur = item.duration.unwrap_or(5.0);

            // Is the timestamp inside this clip?
            let is_target = item.id == clip_id || (linked_selection && item.linked_clip_id.as_ref() == Some(&clip_id));

            if is_target && timestamp > start + 0.05 && timestamp < start + dur - 0.05 {
                let dur_a = timestamp - start;
                let dur_b = dur - dur_a;

                let mut clip_a = item.clone();
                clip_a.id = format!("{}-a1-{}", item.id, cut_time_str);
                clip_a.duration = Some(dur_a);

                let mut clip_b = item.clone();
                clip_b.id = format!("{}-b1-{}", item.id, cut_time_str);
                clip_b.start = Some(timestamp);
                clip_b.duration = Some(dur_b);
                clip_b.trim_in = Some(item.trim_in.unwrap_or(0.0) + dur_a);

                if let Some(linked) = &item.linked_clip_id {
                    clip_a.linked_clip_id = Some(format!("{}-a1-{}", linked, cut_time_str));
                    clip_b.linked_clip_id = Some(format!("{}-b1-{}", linked, cut_time_str));
                }

                track.items[i] = clip_a;
                track.items.insert(i + 1, clip_b);
                i += 1; // skip the newly inserted clip
            }
            i += 1;
        }
    }

    Ok(doc.clone())
}

#[tauri::command]
pub fn trim_clip_cmd(
    clip_id: String,
    edge: String,
    delta_secs: f64,
    linked_selection: bool,
    state: State<'_, AppState>
) -> Result<DocumentState, String> {
    state.commit_history();
    let mut doc = state.state.lock().map_err(|e| e.to_string())?;

    for track in &mut doc.tracks {
        if track.is_locked == Some(true) { continue; }

        for item in &mut track.items {
            let is_target = item.id == clip_id || (linked_selection && item.linked_clip_id.as_ref() == Some(&clip_id));
            if is_target {
                let initial_dur = item.duration.unwrap_or(5.0);
                let initial_start = item.start.unwrap_or(0.0);
                let initial_trim_in = item.trim_in.unwrap_or(0.0);

                if edge == "right" {
                    let raw_dur = (initial_dur + delta_secs).max(0.2);
                    item.duration = Some(raw_dur);
                } else {
                    let clamped_delta = delta_secs.min(initial_dur - 0.2);
                    let new_start = (initial_start + clamped_delta).max(0.0);
                    let new_dur = initial_dur - clamped_delta;
                    let new_trim_in = (initial_trim_in + clamped_delta).max(0.0);

                    item.start = Some(new_start);
                    item.duration = Some(new_dur);
                    item.trim_in = Some(new_trim_in);
                }
            }
        }
    }

    Ok(doc.clone())
}

#[tauri::command]
pub fn get_playback_schedule(state: State<'_, AppState>) -> Result<crate::engine::playback::PlaybackSchedule, String> {
    let doc = state.state.lock().map_err(|e| e.to_string())?;
    Ok(crate::engine::playback::compile_playback_schedule(&doc.tracks))
}

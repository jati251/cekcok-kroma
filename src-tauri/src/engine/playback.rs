use serde::{Deserialize, Serialize};
use crate::state::Track;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackSegment {
    pub id: String,
    pub src: String,
    pub track_id: String,
    pub timeline_start: f64,
    pub timeline_end: f64,
    pub trim_in: f64,
    pub duration: f64,
    pub has_audio: bool,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

/// Compiles multi-track video clips into a flat, chronologically ordered sequence of visible segments.
/// Higher video tracks (V2 > V1) take precedence and occlude lower tracks, matching Premiere Pro logic.
pub fn compile_playback_schedule(tracks: &[Track]) -> Vec<PlaybackSegment> {
    let mut video_tracks: Vec<&Track> = tracks.iter().filter(|t| t.r#type == "video" && t.is_muted != Some(true)).collect();

    // Sort by visual hierarchy: higher track number (e.g. V3 > V2 > V1) has higher priority
    video_tracks.sort_by(|a, b| {
        let get_prio = |t: &Track| -> u32 {
            let s = t.name.to_uppercase();
            if let Some(num) = s.strip_prefix('V') {
                num.parse::<u32>().unwrap_or(1)
            } else {
                1
            }
        };
        get_prio(b).cmp(&get_prio(a)) // Descending: V2 before V1
    });

    // Collect all video clips in priority order
    let mut all_clips: Vec<(usize, &crate::state::DragItem, &str)> = Vec::new();
    for (track_idx, track) in video_tracks.iter().enumerate() {
        for item in &track.items {
            if let Some(src) = &item.src {
                if !src.is_empty() {
                    all_clips.push((track_idx, item, &track.id));
                }
            }
        }
    }

    if all_clips.is_empty() {
        return Vec::new();
    }

    // Find distinct cut boundaries
    let mut boundaries: Vec<f64> = Vec::new();
    for (_, clip, _) in &all_clips {
        let start = clip.start.unwrap_or(0.0);
        let end = start + clip.duration.unwrap_or(0.0);
        boundaries.push(start);
        boundaries.push(end);
    }
    boundaries.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    boundaries.dedup_by(|a, b| (*a - *b).abs() < 0.001);

    let mut segments: Vec<PlaybackSegment> = Vec::new();

    // For each interval [t0, t1], find the top-most visible video clip
    for i in 0..boundaries.len().saturating_sub(1) {
        let t0 = boundaries[i];
        let t1 = boundaries[i + 1];
        let mid = (t0 + t1) / 2.0;

        // Higher track index in video_tracks: reverse iteration checks V2 before V1 if V2 is first
        // Note: in tracks, V2 is index 0, V1 is index 1. So index 0 has highest priority.
        let mut top_clip: Option<(&crate::state::DragItem, &str)> = None;
        for (_, clip, track_id) in &all_clips {
            let start = clip.start.unwrap_or(0.0);
            let end = start + clip.duration.unwrap_or(0.0);
            if mid >= start && mid < end {
                top_clip = Some((clip, track_id));
                break; // First match in top-down order takes precedence
            }
        }

        if let Some((clip, track_id)) = top_clip {
            let start = clip.start.unwrap_or(0.0);
            let trim_in_base = clip.trim_in.unwrap_or(0.0);
            let seg_trim_in = trim_in_base + (t0 - start);
            let seg_duration = t1 - t0;

            if seg_duration > 0.01 {
                // Merge with previous segment if it's the exact same continuous clip
                if let Some(prev) = segments.last_mut() {
                    if prev.id == clip.id && (prev.timeline_end - t0).abs() < 0.005 {
                        prev.timeline_end = t1;
                        prev.duration += seg_duration;
                        continue;
                    }
                }

                segments.push(PlaybackSegment {
                    id: clip.id.clone(),
                    src: clip.src.clone().unwrap_or_default(),
                    track_id: track_id.to_string(),
                    timeline_start: t0,
                    timeline_end: t1,
                    trim_in: seg_trim_in,
                    duration: seg_duration,
                    has_audio: clip.has_audio.unwrap_or(true),
                    width: clip.width,
                    height: clip.height,
                });
            }
        }
    }

    segments
}

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackSchedule {
    pub video_segments: Vec<PlaybackSegment>,
    pub audio_segments: Vec<PlaybackSegment>,
}

/// Compiles multi-track clips into chronologically ordered sequences.
/// Video tracks: Higher tracks (V2 > V1) take precedence and occlude lower tracks.
/// Audio tracks: All tracks mix together concurrently.
pub fn compile_playback_schedule(tracks: &[Track]) -> PlaybackSchedule {
    let mut video_tracks: Vec<&Track> = tracks.iter().filter(|t| t.r#type == "video" && t.is_muted != Some(true)).collect();
    let audio_tracks: Vec<&Track> = tracks.iter().filter(|t| t.r#type == "audio" && t.is_muted != Some(true)).collect();

    // --- VIDEO COMPILATION ---
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

    let mut all_v_clips: Vec<(usize, &crate::state::DragItem, &str)> = Vec::new();
    for (track_idx, track) in video_tracks.iter().enumerate() {
        for item in &track.items {
            if let Some(src) = &item.src {
                if !src.is_empty() {
                    all_v_clips.push((track_idx, item, &track.id));
                }
            }
        }
    }

    let mut v_boundaries: Vec<f64> = Vec::new();
    for (_, clip, _) in &all_v_clips {
        let start = clip.start.unwrap_or(0.0);
        let end = start + clip.duration.unwrap_or(0.0);
        v_boundaries.push(start);
        v_boundaries.push(end);
    }
    v_boundaries.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    v_boundaries.dedup_by(|a, b| (*a - *b).abs() < 0.001);

    let mut video_segments: Vec<PlaybackSegment> = Vec::new();
    for i in 0..v_boundaries.len().saturating_sub(1) {
        let t0 = v_boundaries[i];
        let t1 = v_boundaries[i + 1];
        let mid = (t0 + t1) / 2.0;

        let mut top_clip: Option<(&crate::state::DragItem, &str)> = None;
        for (_, clip, track_id) in &all_v_clips {
            let start = clip.start.unwrap_or(0.0);
            let end = start + clip.duration.unwrap_or(0.0);
            if mid >= start && mid < end {
                top_clip = Some((clip, track_id));
                break; // First match takes precedence
            }
        }

        if let Some((clip, track_id)) = top_clip {
            let start = clip.start.unwrap_or(0.0);
            let trim_in_base = clip.trim_in.unwrap_or(0.0);
            let seg_trim_in = trim_in_base + (t0 - start);
            let seg_duration = t1 - t0;

            if seg_duration > 0.01 {
                if let Some(prev) = video_segments.last_mut() {
                    if prev.id == clip.id && (prev.timeline_end - t0).abs() < 0.005 {
                        prev.timeline_end = t1;
                        prev.duration += seg_duration;
                        continue;
                    }
                }

                video_segments.push(PlaybackSegment {
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

    // --- AUDIO COMPILATION ---
    let mut audio_segments: Vec<PlaybackSegment> = Vec::new();
    for track in &audio_tracks {
        for item in &track.items {
            if let Some(src) = &item.src {
                if !src.is_empty() && item.has_audio != Some(false) {
                    let start = item.start.unwrap_or(0.0);
                    let dur = item.duration.unwrap_or(0.0);
                    if dur > 0.0 {
                        audio_segments.push(PlaybackSegment {
                            id: item.id.clone(),
                            src: src.clone(),
                            track_id: track.id.clone(),
                            timeline_start: start,
                            timeline_end: start + dur,
                            trim_in: item.trim_in.unwrap_or(0.0),
                            duration: dur,
                            has_audio: true,
                            width: None,
                            height: None,
                        });
                    }
                }
            }
        }
    }
    
    // Sort audio segments by start time
    audio_segments.sort_by(|a, b| a.timeline_start.partial_cmp(&b.timeline_start).unwrap_or(std::cmp::Ordering::Equal));

    PlaybackSchedule {
        video_segments,
        audio_segments,
    }
}


use crate::state::{DragItem, Track};

/// Premiere Pro Style Destructive Overwrite (Ripple Edit) in Rust
pub fn overwrite_clip(mut track: Track, incoming_clip: DragItem) -> Track {
    let inc_start = incoming_clip.start.unwrap_or(0.0);
    let inc_end = inc_start + incoming_clip.duration.unwrap_or(0.0);

    let mut new_items: Vec<DragItem> = Vec::new();

    for clip in track.items {
        if clip.id == incoming_clip.id {
            continue;
        }

        let clip_start = clip.start.unwrap_or(0.0);
        let clip_end = clip_start + clip.duration.unwrap_or(0.0);

        // No overlap
        if clip_end <= inc_start || clip_start >= inc_end {
            new_items.push(clip);
            continue;
        }

        // Fully submerged (deleted)
        if clip_start >= inc_start && clip_end <= inc_end {
            continue;
        }

        // Left collision (Trim right side of existing clip)
        if clip_start < inc_start && clip_end <= inc_end {
            let mut modified = clip.clone();
            modified.duration = Some(inc_start - clip_start);
            new_items.push(modified);
            continue;
        }

        // Right collision (Trim left side of existing clip)
        if clip_start >= inc_start && clip_end > inc_end {
            let cut_amount = inc_end - clip_start;
            let mut modified = clip.clone();
            modified.start = Some(inc_end);
            modified.trim_in = Some(clip.trim_in.unwrap_or(0.0) + cut_amount);
            modified.duration = Some(clip.duration.unwrap_or(0.0) - cut_amount);
            new_items.push(modified);
            continue;
        }

        // Split in the middle (Razor cut)
        if clip_start < inc_start && clip_end > inc_end {
            let mut left_part = clip.clone();
            left_part.id = format!("{}-left-split", clip.id);
            left_part.duration = Some(inc_start - clip_start);

            let right_cut_amount = inc_end - clip_start;
            let mut right_part = clip.clone();
            right_part.id = format!("{}-right-split", clip.id);
            right_part.start = Some(inc_end);
            right_part.trim_in = Some(clip.trim_in.unwrap_or(0.0) + right_cut_amount);
            right_part.duration = Some(clip.duration.unwrap_or(0.0) - right_cut_amount);

            new_items.push(left_part);
            new_items.push(right_part);
        }
    }

    // Insert the new clip
    new_items.push(incoming_clip);

    // Sort chronologically
    new_items.sort_by(|a, b| {
        let a_start = a.start.unwrap_or(0.0);
        let b_start = b.start.unwrap_or(0.0);
        a_start.partial_cmp(&b_start).unwrap_or(std::cmp::Ordering::Equal)
    });

    track.items = new_items;
    track
}

import { Track, DragItem } from "../../../types/editor";

/**
 * Premiere Pro Style Destructive Overwrite (Ripple Edit)
 * Inserts a new clip into a track, destructively slicing or removing any existing clips that overlap.
 */
export function overwriteClip(track: Track, incomingClip: DragItem): Track {
  const incStart = incomingClip.start || 0;
  const incEnd = incStart + (incomingClip.duration || 0);

  const newItems: DragItem[] = [];

  for (const clip of track.items) {
    if (clip.id === incomingClip.id) continue;

    const clipStart = clip.start || 0;
    const clipEnd = clipStart + (clip.duration || 0);

    // No overlap
    if (clipEnd <= incStart || clipStart >= incEnd) {
      newItems.push(clip);
      continue;
    }

    // Fully submerged (deleted)
    if (clipStart >= incStart && clipEnd <= incEnd) {
      continue;
    }

    // Left collision (Trim right side of existing clip)
    if (clipStart < incStart && clipEnd <= incEnd) {
      newItems.push({
        ...clip,
        duration: incStart - clipStart,
      });
      continue;
    }

    // Right collision (Trim left side of existing clip)
    if (clipStart >= incStart && clipEnd > incEnd) {
      const cutAmount = incEnd - clipStart;
      newItems.push({
        ...clip,
        start: incEnd,
        trimIn: (clip.trimIn || 0) + cutAmount,
        duration: (clip.duration || 0) - cutAmount,
      });
      continue;
    }

    // Split in the middle (Razor cut)
    if (clipStart < incStart && clipEnd > incEnd) {
      const leftPart: DragItem = {
        ...clip,
        id: `${clip.id}-left-split`,
        duration: incStart - clipStart,
      };

      const rightCutAmount = incEnd - clipStart;
      const rightPart: DragItem = {
        ...clip,
        id: `${clip.id}-right-split`,
        start: incEnd,
        trimIn: (clip.trimIn || 0) + rightCutAmount,
        duration: (clip.duration || 0) - rightCutAmount,
      };

      newItems.push(leftPart, rightPart);
    }
  }

  // Insert the new clip
  newItems.push(incomingClip);

  // Sort chronologically
  newItems.sort((a, b) => (a.start || 0) - (b.start || 0));

  return {
    ...track,
    items: newItems,
  };
}

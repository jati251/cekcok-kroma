import { Track } from "../../../types/editor";

interface SnapParams {
  candidateStart: number;
  duration: number;
  tracks: Track[];
  excludeClipId?: string;
  excludeLinkedId?: string;
  playheadPosition: number;
  inPoint: number | null;
  outPoint: number | null;
  zoomLevel: number;
}

interface SnapResult {
  snappedStart: number;
  snapLineTime: number | null;
}

export function calculateSnapPosition({
  candidateStart,
  duration,
  tracks,
  excludeClipId,
  excludeLinkedId,
  playheadPosition,
  inPoint,
  outPoint,
  zoomLevel,
}: SnapParams): SnapResult {
  const thresholdSecs = 10 / zoomLevel; // 10 pixels magnetic radius

  // Collect all potential snap points
  const snapTargets: number[] = [0, playheadPosition];

  if (inPoint !== null) snapTargets.push(inPoint);
  if (outPoint !== null) snapTargets.push(outPoint);

  tracks.forEach((track) => {
    track.items.forEach((clip) => {
      if (clip.id === excludeClipId || clip.id === excludeLinkedId) return;
      const cStart = clip.start || 0;
      const cEnd = cStart + (clip.duration || 0);
      snapTargets.push(cStart);
      snapTargets.push(cEnd);
    });
  });

  const candidateEnd = candidateStart + duration;

  // 1. Check if start edge snaps to any target
  for (const target of snapTargets) {
    if (Math.abs(candidateStart - target) <= thresholdSecs) {
      return {
        snappedStart: target,
        snapLineTime: target,
      };
    }
  }

  // 2. Check if end edge snaps to any target
  for (const target of snapTargets) {
    if (Math.abs(candidateEnd - target) <= thresholdSecs) {
      return {
        snappedStart: Math.max(0, target - duration),
        snapLineTime: target,
      };
    }
  }

  return {
    snappedStart: Math.max(0, candidateStart),
    snapLineTime: null,
  };
}

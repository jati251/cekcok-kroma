import { DEFAULT_FPS } from "../constants/editor";

/**
 * Formats seconds into SMPTE timecode (HH:MM:SS:FF)
 */
export function formatTimecode(seconds: number, fps: number = DEFAULT_FPS): string {
  const safeSeconds = Math.max(0, seconds);
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = Math.floor(safeSeconds % 60);
  const f = Math.floor((safeSeconds % 1) * fps);

  return [
    h.toString().padStart(2, "0"),
    m.toString().padStart(2, "0"),
    s.toString().padStart(2, "0"),
    f.toString().padStart(2, "0"),
  ].join(":");
}

/**
 * Calculates time offset from pixel movement and zoom level
 */
export function pixelsToSeconds(pixels: number, zoomLevel: number): number {
  if (zoomLevel <= 0) return 0;
  return pixels / zoomLevel;
}

/**
 * Converts seconds to timeline pixel width or position
 */
export function secondsToPixels(seconds: number, zoomLevel: number): number {
  return Math.max(0, seconds) * zoomLevel;
}

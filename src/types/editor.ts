export interface DragItem {
  id: string;
  type: "media" | "clip";
  name: string;
  color?: string;
  start?: number; // timestamp in sequence (seconds)
  duration?: number; // duration on timeline (seconds)
  trimIn?: number; // offset into source media file (seconds)
  src?: string; // local file path
  hasAudio?: boolean;
  waveform?: number[];
  linkedClipId?: string; // ID of paired video or audio clip
  width?: number;
  height?: number;
}

export interface Track {
  id: string;
  name: string;
  type: "video" | "audio";
  isLocked?: boolean;
  items: DragItem[];
}

export type Tool = "selection" | "razor" | "hand";

export interface DragCursorPosition {
  x: number;
  y: number;
}

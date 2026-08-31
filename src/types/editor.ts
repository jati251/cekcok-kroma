export interface DragItem {
  id: string;
  type: "media" | "clip";
  name: string;
  color?: string;
  start?: number; // timestamp in seconds
  duration?: number; // duration in seconds
  src?: string; // local file path
  hasAudio?: boolean;
  waveform?: number[];
  linkedClipId?: string;
  width?: number;
  height?: number;
}

export interface Track {
  id: string;
  name: string;
  type: "video" | "audio";
  items: DragItem[];
}

export type Tool = "selection" | "razor" | "hand";

export interface DragCursorPosition {
  x: number;
  y: number;
}

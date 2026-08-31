export interface DragItem {
  id: string;
  type: "media" | "clip";
  name: string;
  color?: string;
  start?: number; // timestamp in seconds
  duration?: number; // duration in seconds
  src?: string; // local file path
}

export interface Track {
  id: string;
  name: string;
  items: DragItem[];
}

export type Tool = "selection" | "razor" | "hand";

export interface DragCursorPosition {
  x: number;
  y: number;
}

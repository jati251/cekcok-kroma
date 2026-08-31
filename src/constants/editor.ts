import { Track } from "../types/editor";

export const DEFAULT_FPS = 30;

export const ZOOM_LIMITS = {
  MIN: 10,
  MAX: 300,
  DEFAULT: 100,
} as const;

export const DEFAULT_TRACKS: Track[] = [
  { id: "v1", name: "V1", type: "video", items: [] },
  { id: "v2", name: "V2", type: "video", items: [] },
  { id: "a1", name: "A1", type: "audio", items: [] },
  { id: "a2", name: "A2", type: "audio", items: [] },
];

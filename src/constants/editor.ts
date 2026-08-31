import { Track } from "../types/editor";

export const DEFAULT_FPS = 30;

export const ZOOM_LIMITS = {
  MIN: 10,
  MAX: 300,
  DEFAULT: 100,
} as const;

export const DEFAULT_TRACKS: Track[] = [
  { id: "v1", name: "V1", items: [] },
  { id: "v2", name: "V2", items: [] },
  { id: "a1", name: "A1", items: [] },
];

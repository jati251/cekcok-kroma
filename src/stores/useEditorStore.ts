import { create } from "zustand";

export interface DragItem {
  id: string;
  type: "media" | "clip";
  name: string;
  color?: string;
  start?: number; // now in seconds
  duration?: number; // now in seconds
  src?: string; // real file path
}

export type Tool = "selection" | "razor" | "hand";

interface EditorStore {
  // Drag state
  draggedItem: DragItem | null;
  setDraggedItem: (item: DragItem | null) => void;
  
  // Tool state
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;

  // Timeline state
  playheadPosition: number; // in seconds
  setPlayheadPosition: (pos: number) => void;
  zoomLevel: number; // pixels per second
  setZoomLevel: (zoom: number) => void;

  // Selection state
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
  
  // Media Bin State
  mediaItems: DragItem[];
  addMediaItem: (item: DragItem) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  draggedItem: null,
  setDraggedItem: (item) => set({ draggedItem: item }),
  
  activeTool: "selection",
  setActiveTool: (tool) => set({ activeTool: tool }),

  playheadPosition: 0,
  setPlayheadPosition: (pos) => set({ playheadPosition: pos }),
  zoomLevel: 100, // 100px = 1 second
  setZoomLevel: (zoom) => set({ zoomLevel: zoom }),

  selectedClipId: null,
  setSelectedClipId: (id) => set({ selectedClipId: id }),
  
  mediaItems: [],
  addMediaItem: (item) => set((state) => ({ mediaItems: [...state.mediaItems, item] })),
}));

// Utility for SMPTE timecode (HH:MM:SS:FF) assuming 30fps
export const formatTimecode = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 30);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
};

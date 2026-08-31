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

export interface Track {
  id: string;
  name: string;
  items: DragItem[];
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

  // Selection & Delete
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
  deleteSelectedClip: () => void;
  
  // Playback
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;

  // Tracks State
  tracks: Track[];
  setTracks: (updater: (prev: Track[]) => Track[]) => void;
  
  // Media Bin State
  mediaItems: DragItem[];
  addMediaItem: (item: DragItem) => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  draggedItem: null,
  setDraggedItem: (item) => set({ draggedItem: item }),
  
  activeTool: "selection",
  setActiveTool: (tool) => set({ activeTool: tool }),

  playheadPosition: 0,
  setPlayheadPosition: (pos) => set({ playheadPosition: pos }),
  
  zoomLevel: 100, // 100px = 1 second
  setZoomLevel: (zoom) => set({ zoomLevel: Math.min(300, Math.max(10, zoom)) }),

  selectedClipId: null,
  setSelectedClipId: (id) => set({ selectedClipId: id }),
  
  deleteSelectedClip: () => {
    const state = get();
    if (!state.selectedClipId) return;
    state.setTracks((prev) => 
      prev.map(t => ({
        ...t,
        items: t.items.filter(item => item.id !== state.selectedClipId)
      }))
    );
    set({ selectedClipId: null });
  },

  isPlaying: false,
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  tracks: [
    { id: "v1", name: "V1", items: [] },
    { id: "v2", name: "V2", items: [] },
    { id: "a1", name: "A1", items: [] },
  ],
  setTracks: (updater) => set((state) => ({ tracks: updater(state.tracks) })),
  
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

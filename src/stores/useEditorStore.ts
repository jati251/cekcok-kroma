import { create } from "zustand";
import { DragItem, Track, Tool, DragCursorPosition } from "../types/editor";
import { DEFAULT_TRACKS, ZOOM_LIMITS, DEFAULT_FPS } from "../constants/editor";
import { formatTimecode } from "../utils/timecode";

// Re-export types for backward compatibility across features
export type { DragItem, Track, Tool, DragCursorPosition };
export { formatTimecode };

interface EditorStore {
  // Drag state
  draggedItem: DragItem | null;
  setDraggedItem: (item: DragItem | null) => void;
  dragCursor: DragCursorPosition | null;
  setDragCursor: (pos: DragCursorPosition | null) => void;

  // Tool state
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;

  // Timeline & Playhead
  playheadPosition: number; // in seconds
  setPlayheadPosition: (pos: number) => void;
  zoomLevel: number; // pixels per second
  setZoomLevel: (zoom: number) => void;

  // Range In/Out points
  inPoint: number | null;
  outPoint: number | null;
  setInPoint: (pos: number | null) => void;
  setOutPoint: (pos: number | null) => void;
  stepFrame: (frames: number) => void;

  // Linked Selection Toggle (Premiere Pro Cmd+L)
  linkedSelection: boolean;
  toggleLinkedSelection: () => void;

  // Snapping / Magnet Tool (Premiere Pro S)
  isSnapping: boolean;
  toggleSnapping: () => void;

  // Clip Selection & Editing
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
  deleteSelectedClip: () => void;

  // Playback state
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  masterVolume: number;
  setMasterVolume: (vol: number) => void;
  isMasterMuted: boolean;
  toggleMasterMute: () => void;

  // Sequence Tracks & Locking & Muting
  tracks: Track[];
  setTracks: (updater: (prev: Track[]) => Track[]) => void;
  toggleTrackLock: (trackId: string) => void;
  toggleTrackMute: (trackId: string) => void;

  // Media Bin Items
  mediaItems: DragItem[];
  addMediaItem: (item: DragItem) => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  draggedItem: null,
  setDraggedItem: (item) => set({ draggedItem: item }),
  dragCursor: null,
  setDragCursor: (pos) => set({ dragCursor: pos }),

  activeTool: "selection",
  setActiveTool: (tool) => set({ activeTool: tool }),

  playheadPosition: 0,
  setPlayheadPosition: (pos) => set({ playheadPosition: Math.max(0, pos) }),

  zoomLevel: ZOOM_LIMITS.DEFAULT,
  setZoomLevel: (zoom) =>
    set({ zoomLevel: Math.min(ZOOM_LIMITS.MAX, Math.max(ZOOM_LIMITS.MIN, zoom)) }),

  inPoint: null,
  outPoint: null,
  setInPoint: (pos) => set({ inPoint: pos }),
  setOutPoint: (pos) => set({ outPoint: pos }),
  stepFrame: (frames) => {
    const current = get().playheadPosition;
    set({ playheadPosition: Math.max(0, current + frames / DEFAULT_FPS) });
  },

  linkedSelection: true,
  toggleLinkedSelection: () =>
    set((state) => ({ linkedSelection: !state.linkedSelection })),

  isSnapping: true,
  toggleSnapping: () =>
    set((state) => ({ isSnapping: !state.isSnapping })),

  selectedClipId: null,
  setSelectedClipId: (id) => set({ selectedClipId: id }),

  deleteSelectedClip: () => {
    const state = get();
    if (!state.selectedClipId) return;

    // If linkedSelection is ON, find and delete linked audio/video as well
    let linkedId: string | undefined;
    if (state.linkedSelection) {
      for (const t of state.tracks) {
        const found = t.items.find((item) => item.id === state.selectedClipId);
        if (found) {
          linkedId = found.linkedClipId;
          break;
        }
      }
    }

    state.setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        items: t.items.filter(
          (item) => item.id !== state.selectedClipId && (!linkedId || item.id !== linkedId)
        ),
      }))
    );
    set({ selectedClipId: null });
  },

  isPlaying: false,
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  masterVolume: 1,
  setMasterVolume: (vol) => set({ masterVolume: Math.max(0, Math.min(1, vol)) }),
  isMasterMuted: false,
  toggleMasterMute: () => set((state) => ({ isMasterMuted: !state.isMasterMuted })),

  tracks: DEFAULT_TRACKS,
  setTracks: (updater) => set((state) => ({ tracks: updater(state.tracks) })),

  toggleTrackLock: (trackId: string) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, isLocked: !t.isLocked } : t
      ),
    }));
  },

  toggleTrackMute: (trackId: string) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, isMuted: !t.isMuted } : t
      ),
    }));
  },

  mediaItems: [],
  addMediaItem: (item) =>
    set((state) => ({ mediaItems: [...state.mediaItems, item] })),
}));

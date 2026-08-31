import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { DragItem, Track, Tool, DragCursorPosition } from "../types/editor";
import { DEFAULT_TRACKS, ZOOM_LIMITS, DEFAULT_FPS } from "../constants/editor";
import { formatTimecode } from "../utils/timecode";

// Re-export types for backward compatibility across features
export type { DragItem, Track, Tool, DragCursorPosition };
export { formatTimecode };

export interface DocumentState {
  tracks: Track[];
  mediaItems: DragItem[];
}

interface EditorStore {
  // Project File state
  projectFilePath: string | null;
  setProjectFilePath: (path: string | null) => void;
  loadDocumentState: (state: DocumentState) => void;

  // Rust Backend synchronization
  fetchState: () => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;

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

  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
  deleteSelectedClip: () => Promise<void>;

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
  addMediaItem: (item: DragItem) => Promise<void>;
  addMediaItems: (items: DragItem[]) => Promise<void>;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  projectFilePath: null,
  setProjectFilePath: (path) => set({ projectFilePath: path }),
  loadDocumentState: (docState) => set({
    tracks: docState.tracks,
    mediaItems: docState.mediaItems,
    selectedClipId: null,
  }),

  fetchState: async () => {
    try {
      const docState: DocumentState = await invoke("get_state");
      set({ tracks: docState.tracks, mediaItems: docState.mediaItems });
    } catch (e) {
      console.error("Failed to fetch state from Rust:", e);
    }
  },

  undo: async () => {
    try {
      const prev: DocumentState = await invoke("undo_action_cmd");
      set({
        tracks: prev.tracks,
        mediaItems: prev.mediaItems,
        selectedClipId: null,
      });
    } catch (e) {
      console.error("Failed to undo:", e);
    }
  },

  redo: async () => {
    try {
      const next: DocumentState = await invoke("redo_action_cmd");
      set({
        tracks: next.tracks,
        mediaItems: next.mediaItems,
        selectedClipId: null,
      });
    } catch (e) {
      console.error("Failed to redo:", e);
    }
  },

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

  deleteSelectedClip: async () => {
    const state = get();
    if (!state.selectedClipId) return;

    try {
      const newDoc: DocumentState = await invoke("delete_clip", {
        clipId: state.selectedClipId,
        linkedSelection: state.linkedSelection
      });
      set({
        tracks: newDoc.tracks,
        selectedClipId: null
      });
    } catch (e) {
      console.error("Failed to delete clip:", e);
    }
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
  addMediaItem: async (item) => {
    try {
      const newDoc: DocumentState = await invoke("add_media_to_bin", { item });
      set({ mediaItems: newDoc.mediaItems });
    } catch (e) {
      console.error("Failed to add media to bin:", e);
    }
  },
  addMediaItems: async (items) => {
    try {
      const newDoc: DocumentState = await invoke("add_media_batch_to_bin", { items });
      set({ mediaItems: newDoc.mediaItems });
    } catch (e) {
      console.error("Failed to add media batch to bin:", e);
    }
  },
}));

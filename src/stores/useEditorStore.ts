import { create } from "zustand";

export interface DragItem {
  id: string;
  type: "media" | "clip";
  name: string;
  color?: string;
  start?: number;
  duration?: number;
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
  playheadPosition: number; // in pixels or frames
  setPlayheadPosition: (pos: number) => void;

  // Selection state
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  draggedItem: null,
  setDraggedItem: (item) => set({ draggedItem: item }),
  
  activeTool: "selection",
  setActiveTool: (tool) => set({ activeTool: tool }),

  playheadPosition: 0,
  setPlayheadPosition: (pos) => set({ playheadPosition: pos }),

  selectedClipId: null,
  setSelectedClipId: (id) => set({ selectedClipId: id }),
}));

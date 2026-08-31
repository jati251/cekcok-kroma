import { create } from "zustand";

export interface DragItem {
  id: string;
  type: "media" | "clip";
  name: string;
  color?: string;
}

interface DragStore {
  draggedItem: DragItem | null;
  setDraggedItem: (item: DragItem | null) => void;
}

export const useDragStore = create<DragStore>((set) => ({
  draggedItem: null,
  setDraggedItem: (item) => set({ draggedItem: item }),
}));

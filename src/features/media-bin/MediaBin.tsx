import { motion } from "framer-motion";
import { useDragStore, DragItem } from "../../stores/useDragStore";

const MOCK_MEDIA: DragItem[] = [
  { id: "media-1", type: "media", name: "Footage_01.mp4", color: "#3b82f6" },
  { id: "media-2", type: "media", name: "B-Roll_A.mov", color: "#10b981" },
  { id: "media-3", type: "media", name: "Interview.mp4", color: "#8b5cf6" },
];

export function MediaBin() {
  const { setDraggedItem } = useDragStore();

  return (
    <div className="w-1/4 border-r border-border bg-secondary flex flex-col h-full">
      <div className="p-2 border-b border-border text-xs font-medium uppercase tracking-wider text-zinc-400">
        Project Media
      </div>
      <div className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto">
        {MOCK_MEDIA.map((item) => (
          <motion.div
            key={item.id}
            drag
            dragSnapToOrigin
            onDragStart={() => setDraggedItem(item)}
            onDragEnd={() => setDraggedItem(null)}
            className="p-3 bg-primary border border-border rounded shadow-sm cursor-grab active:cursor-grabbing flex items-center gap-3 hover:bg-primary/80 transition-colors z-10"
            whileDrag={{ scale: 1.05, opacity: 0.8, zIndex: 50 }}
          >
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm text-zinc-300">{item.name}</span>
          </motion.div>
        ))}
        {MOCK_MEDIA.length === 0 && (
          <div className="text-sm text-zinc-600 text-center mt-4">
            No media imported
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { motion } from "framer-motion";
import { useDragStore, DragItem } from "../../stores/useDragStore";

interface Track {
  id: string;
  name: string;
  items: (DragItem & { start: number; duration: number })[];
}

export function Timeline() {
  const { draggedItem, setDraggedItem } = useDragStore();
  const [tracks, setTracks] = useState<Track[]>([
    { id: "v1", name: "V1", items: [] },
    { id: "a1", name: "A1", items: [] },
  ]);

  const handlePointerUp = (trackId: string) => {
    if (draggedItem) {
      setTracks((prev) =>
        prev.map((track) => {
          if (track.id === trackId) {
            return {
              ...track,
              items: [
                ...track.items,
                { ...draggedItem, start: track.items.length * 100, duration: 150 },
              ],
            };
          }
          return track;
        })
      );
      // setDraggedItem is usually reset by onDragEnd in MediaBin, but this acts as the "drop" commit
    }
  };

  return (
    <div className="h-[40%] border-t border-border bg-secondary flex flex-col">
      <div className="p-2 border-b border-border text-xs font-medium uppercase tracking-wider text-zinc-400">
        Timeline
      </div>
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {/* Time ruler */}
        <div className="h-6 border-b border-border bg-primary/50" />
        
        {/* Tracks */}
        <div className="flex-1 p-2 space-y-2 overflow-y-auto relative">
          {tracks.map((track) => (
            <div
              key={track.id}
              onPointerUp={() => handlePointerUp(track.id)}
              className={`h-16 border rounded flex items-center relative transition-colors ${
                draggedItem ? "bg-accent/5 border-accent/50" : "bg-primary/20 border-border"
              }`}
            >
              {/* Track Header */}
              <div className="w-16 h-full border-r border-border bg-primary/40 flex items-center justify-center absolute left-0 z-10 shrink-0">
                <span className="text-xs text-zinc-500 font-medium">{track.name}</span>
              </div>
              
              {/* Track Content */}
              <div className="flex-1 h-full relative ml-16 overflow-hidden">
                {track.items.map((item, idx) => (
                  <motion.div
                    key={`${item.id}-${idx}`}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    drag="x"
                    dragConstraints={{ left: 0 }}
                    className="absolute h-[80%] top-[10%] rounded flex items-center px-2 text-xs shadow-sm cursor-ew-resize border border-black/20"
                    style={{
                      left: item.start,
                      width: item.duration,
                      backgroundColor: item.color,
                      color: "white"
                    }}
                  >
                    <span className="truncate w-full drop-shadow-md">{item.name}</span>
                  </motion.div>
                ))}
                
                {/* Drop indicator outline */}
                {draggedItem && (
                  <div className="absolute inset-y-1 right-2 left-2 border-2 border-dashed border-accent/30 rounded pointer-events-none" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

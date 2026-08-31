import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useEditorStore, DragItem } from "../../stores/useEditorStore";

interface Track {
  id: string;
  name: string;
  items: (DragItem & { start: number; duration: number })[];
}

export function Timeline() {
  const { draggedItem, activeTool, playheadPosition, setPlayheadPosition, selectedClipId, setSelectedClipId } = useEditorStore();
  const [tracks, setTracks] = useState<Track[]>([
    { id: "v1", name: "V1", items: [] },
    { id: "a1", name: "A1", items: [] },
  ]);
  const timelineRef = useRef<HTMLDivElement>(null);

  const handlePointerUp = (trackId: string) => {
    if (draggedItem && activeTool === "selection") {
      setTracks((prev) =>
        prev.map((track) => {
          if (track.id === trackId) {
            return {
              ...track,
              items: [
                ...track.items,
                { ...draggedItem, id: `${draggedItem.id}-${Date.now()}`, start: track.items.length * 100, duration: 150 },
              ],
            };
          }
          return track;
        })
      );
    }
  };

  const handleClipClick = (e: React.MouseEvent, trackId: string, itemIdx: number, item: any) => {
    e.stopPropagation();
    if (activeTool === "selection") {
      setSelectedClipId(item.id);
    } else if (activeTool === "razor") {
      // Split the clip at playhead or click position (for simplicity, split at middle)
      setTracks((prev) =>
        prev.map((track) => {
          if (track.id === trackId) {
            const newItems = [...track.items];
            const target = newItems[itemIdx];
            const halfDuration = target.duration / 2;
            
            // Create two clips from one
            const clipA = { ...target, id: `${target.id}-a`, duration: halfDuration };
            const clipB = { ...target, id: `${target.id}-b`, start: target.start + halfDuration, duration: halfDuration };
            
            newItems.splice(itemIdx, 1, clipA, clipB);
            return { ...track, items: newItems };
          }
          return track;
        })
      );
    }
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      setPlayheadPosition(Math.max(0, x - 64)); // subtract track header width
    }
  };

  return (
    <div className="h-[40%] border-t border-border bg-secondary flex flex-col relative select-none">
      <div className="p-2 border-b border-border text-xs font-medium uppercase tracking-wider text-zinc-400 flex justify-between">
        <span>Timeline</span>
        <span className="font-mono text-accent">{playheadPosition}px</span>
      </div>
      <div 
        className="flex-1 relative overflow-hidden flex flex-col"
        ref={timelineRef}
        onClick={handleTimelineClick}
      >
        {/* Time ruler */}
        <div className="h-6 border-b border-border bg-primary/50 flex relative cursor-text">
          <div className="w-16 h-full border-r border-border shrink-0 bg-primary/80" />
          {/* Playhead Handle */}
          <motion.div
            drag="x"
            dragConstraints={{ left: 0 }}
            dragElastic={0}
            dragMomentum={false}
            onDrag={(_, info) => setPlayheadPosition(Math.max(0, playheadPosition + info.delta.x))}
            className="absolute top-0 w-3 h-full -ml-1.5 bg-accent z-30 cursor-ew-resize flex justify-center"
            style={{ left: playheadPosition + 64 }}
          >
            <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-white mt-1" />
          </motion.div>
        </div>
        
        {/* Tracks Area */}
        <div className="flex-1 p-2 space-y-2 overflow-y-auto relative">
          {/* Playhead Line */}
          <div 
            className="absolute top-0 bottom-0 w-px bg-accent z-20 pointer-events-none"
            style={{ left: playheadPosition + 64 }}
          />

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
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    drag={activeTool === "selection" ? "x" : false}
                    dragConstraints={{ left: 0 }}
                    dragMomentum={false}
                    onDragEnd={(_, info) => {
                      const newStart = Math.max(0, item.start + info.offset.x);
                      setTracks(prev => prev.map(t => {
                        if (t.id === track.id) {
                          const newItems = [...t.items];
                          newItems[idx] = { ...item, start: newStart };
                          return { ...t, items: newItems };
                        }
                        return t;
                      }));
                    }}
                    onClick={(e) => handleClipClick(e, track.id, idx, item)}
                    className={`absolute h-[80%] top-[10%] rounded flex items-center px-2 text-xs shadow-sm border ${
                      selectedClipId === item.id ? "border-white" : "border-black/20"
                    } ${activeTool === "razor" ? "cursor-crosshair hover:bg-accent/80" : "cursor-ew-resize hover:brightness-110"}`}
                    style={{
                      left: item.start,
                      width: item.duration,
                      backgroundColor: item.color,
                      color: "white"
                    }}
                  >
                    <span className="truncate w-full drop-shadow-md pointer-events-none">{item.name}</span>
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

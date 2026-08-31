import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useEditorStore, DragItem, formatTimecode } from "../../stores/useEditorStore";
import { TimeRuler } from "./TimeRuler";

interface Track {
  id: string;
  name: string;
  items: DragItem[];
}

export function Timeline() {
  const { 
    draggedItem, activeTool, 
    playheadPosition, setPlayheadPosition, 
    zoomLevel, setZoomLevel,
    selectedClipId, setSelectedClipId 
  } = useEditorStore();
  
  const [tracks, setTracks] = useState<Track[]>([
    { id: "v1", name: "V1", items: [] },
    { id: "v2", name: "V2", items: [] },
    { id: "a1", name: "A1", items: [] },
  ]);
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(1000);

  useEffect(() => {
    if (timelineRef.current) {
      setTimelineWidth(timelineRef.current.clientWidth - 64);
    }
    const handleResize = () => {
      if (timelineRef.current) {
        setTimelineWidth(timelineRef.current.clientWidth - 64);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handlePointerUp = (trackId: string) => {
    if (draggedItem && activeTool === "selection") {
      setTracks((prev) =>
        prev.map((track) => {
          if (track.id === trackId) {
            // Drop at the end of the track or at playhead if we want to be fancy
            // For now, drop at the end
            const lastItem = track.items[track.items.length - 1];
            const start = lastItem ? (lastItem.start || 0) + (lastItem.duration || 0) : 0;
            const duration = draggedItem.duration || 5; // default 5s if unknown
            
            return {
              ...track,
              items: [
                ...track.items,
                { ...draggedItem, id: `${draggedItem.id}-${Date.now()}`, start, duration },
              ],
            };
          }
          return track;
        })
      );
    }
  };

  const handleClipClick = (e: React.MouseEvent, trackId: string, itemIdx: number, item: DragItem) => {
    e.stopPropagation();
    if (activeTool === "selection") {
      setSelectedClipId(item.id);
    } else if (activeTool === "razor") {
      setTracks((prev) =>
        prev.map((track) => {
          if (track.id === trackId) {
            const newItems = [...track.items];
            const target = newItems[itemIdx];
            
            // Try to split at playhead position, if playhead is inside clip
            let splitPos = playheadPosition;
            const start = target.start || 0;
            const dur = target.duration || 0;
            
            if (splitPos <= start || splitPos >= start + dur) {
               // Fallback: split in the middle of the clip if playhead is elsewhere
               splitPos = start + (dur / 2);
            }
            
            const durA = splitPos - start;
            const durB = dur - durA;
            
            const clipA = { ...target, id: `${target.id}-a`, duration: durA };
            const clipB = { ...target, id: `${target.id}-b`, start: splitPos, duration: durB };
            
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
      const x = e.clientX - rect.left - 64; // adjust for track header
      if (x >= 0) {
        setPlayheadPosition(x / zoomLevel);
      }
    }
  };

  return (
    <div className="h-[40%] border-t border-border bg-secondary flex flex-col relative select-none">
      <div className="p-2 border-b border-border text-xs font-medium uppercase tracking-wider text-zinc-400 flex justify-between items-center">
        <span>Timeline</span>
        <div className="flex items-center gap-4">
          <input 
            type="range" 
            min="10" 
            max="300" 
            value={zoomLevel} 
            onChange={(e) => setZoomLevel(Number(e.target.value))}
            className="w-24 accent-accent"
            title="Zoom"
          />
          <span className="font-mono text-accent bg-background px-2 py-1 rounded border border-border">
            {formatTimecode(playheadPosition)}
          </span>
        </div>
      </div>
      <div 
        className="flex-1 relative overflow-x-auto overflow-y-hidden flex flex-col bg-background/50"
        ref={timelineRef}
      >
        <div className="min-w-max relative flex-1 flex flex-col" style={{ width: Math.max(timelineWidth + 64, 3000) }}>
          {/* Time ruler */}
          <div className="h-6 border-b border-border bg-primary/50 flex relative cursor-text sticky top-0 z-40" onClick={handleTimelineClick}>
            <div className="w-16 h-full border-r border-border shrink-0 bg-primary/80 sticky left-0 z-50" />
            
            <div className="flex-1 relative overflow-hidden">
              <TimeRuler zoomLevel={zoomLevel} width={Math.max(timelineWidth, 3000)} />
              {/* Playhead Handle */}
              <motion.div
                drag="x"
                dragConstraints={{ left: 0 }}
                dragElastic={0}
                dragMomentum={false}
                onDrag={(_, info) => {
                  const newX = (playheadPosition * zoomLevel) + info.delta.x;
                  setPlayheadPosition(Math.max(0, newX / zoomLevel));
                }}
                className="absolute top-0 w-3 h-full -ml-1.5 bg-accent z-30 cursor-ew-resize flex justify-center"
                style={{ left: playheadPosition * zoomLevel }}
              >
                <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-white mt-1" />
              </motion.div>
            </div>
          </div>
          
          {/* Tracks Area */}
          <div className="flex-1 space-y-1 relative pt-2 pb-8">
            {/* Playhead Line */}
            <div 
              className="absolute top-0 bottom-0 w-px bg-accent z-20 pointer-events-none"
              style={{ left: (playheadPosition * zoomLevel) + 64 }}
            />

            {tracks.map((track) => (
              <div
                key={track.id}
                onPointerUp={() => handlePointerUp(track.id)}
                className={`h-16 border-y flex items-center relative transition-colors ${
                  draggedItem ? "bg-accent/5 border-accent/50" : "bg-primary/20 border-border/40"
                }`}
              >
                {/* Track Header */}
                <div className="w-16 h-full border-r border-border bg-primary/40 flex items-center justify-center sticky left-0 z-30 shrink-0">
                  <span className="text-xs text-zinc-500 font-medium">{track.name}</span>
                </div>
                
                {/* Track Content */}
                <div className="flex-1 h-full relative">
                  {track.items.map((item, idx) => (
                    <motion.div
                      key={`${item.id}-${idx}`}
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      drag={activeTool === "selection" ? "x" : false}
                      dragConstraints={{ left: 0 }}
                      dragMomentum={false}
                      onDragEnd={(_, info) => {
                        const newStartSecs = Math.max(0, (item.start || 0) + (info.offset.x / zoomLevel));
                        setTracks(prev => prev.map(t => {
                          if (t.id === track.id) {
                            const newItems = [...t.items];
                            newItems[idx] = { ...item, start: newStartSecs };
                            return { ...t, items: newItems };
                          }
                          return t;
                        }));
                      }}
                      onClick={(e) => handleClipClick(e, track.id, idx, item)}
                      className={`absolute h-[80%] top-[10%] rounded flex items-center px-2 text-xs shadow-sm border ${
                        selectedClipId === item.id ? "border-white" : "border-black/40"
                      } ${activeTool === "razor" ? "cursor-crosshair hover:bg-red-500/80" : "cursor-ew-resize hover:brightness-110"}`}
                      style={{
                        left: (item.start || 0) * zoomLevel,
                        width: (item.duration || 0) * zoomLevel,
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
    </div>
  );
}

// Needed to share tracks state to ProgramMonitor
// In a real app, tracks would be in the EditorStore.
// For now, let's keep it here, but ideally we should move it.

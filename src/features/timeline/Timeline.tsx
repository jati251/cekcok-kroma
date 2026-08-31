import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useEditorStore, DragItem, formatTimecode } from "../../stores/useEditorStore";
import { TimeRuler } from "./TimeRuler";

export function Timeline() {
  const { 
    draggedItem, activeTool, 
    playheadPosition, setPlayheadPosition, 
    zoomLevel, setZoomLevel,
    selectedClipId, setSelectedClipId,
    tracks, setTracks
  } = useEditorStore();
  
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
            const lastItem = track.items[track.items.length - 1];
            const start = lastItem ? (lastItem.start || 0) + (lastItem.duration || 0) : 0;
            const duration = draggedItem.duration || 5; 
            
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
            
            let splitPos = playheadPosition;
            const start = target.start || 0;
            const dur = target.duration || 0;
            
            if (splitPos <= start || splitPos >= start + dur) {
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
      const x = e.clientX - rect.left - 64; 
      if (x >= 0) {
        setPlayheadPosition(x / zoomLevel);
      }
    }
  };

  const getTimelineCursorClass = () => {
    switch (activeTool) {
      case "razor": return "cursor-crosshair";
      case "hand": return "cursor-grab active:cursor-grabbing";
      default: return "cursor-default";
    }
  };

  return (
    <div className="flex-1 bg-[var(--panel-bg)] flex flex-col relative select-none border border-[var(--panel-border)] overflow-hidden">
      {/* Timeline Header */}
      <div className="h-6 px-3 flex items-center justify-between bg-[#2d2d2d] border-b border-[#111]">
        <span className="text-[11px] text-[#ccc]">Timeline: Sequence 01</span>
        <div className="flex items-center gap-2">
          <input 
            type="range" 
            min="10" 
            max="300" 
            value={zoomLevel} 
            onChange={(e) => setZoomLevel(Number(e.target.value))}
            className="w-20 accent-accent"
            title="Zoom (+ / -)"
          />
        </div>
      </div>

      <div 
        className={`flex-1 relative overflow-x-auto overflow-y-hidden flex flex-col ${getTimelineCursorClass()}`}
        ref={timelineRef}
      >
        <div className="min-w-max relative flex-1 flex flex-col" style={{ width: Math.max(timelineWidth + 64, 3000) }}>
          
          {/* Time ruler */}
          <div className="h-6 border-b border-[#111] bg-[#1a1a1a] flex relative cursor-text sticky top-0 z-40" onClick={handleTimelineClick}>
            <div className="w-16 h-full border-r border-[#111] bg-[#222] sticky left-0 z-50 flex items-center justify-center">
              <span className="text-[9px] text-[#777] font-mono">{formatTimecode(playheadPosition).substring(3)}</span>
            </div>
            
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
                <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-accent mt-1" />
                <div className="absolute top-[7px] bottom-0 w-[1px] bg-accent" />
              </motion.div>
            </div>
          </div>
          
          {/* Tracks Area */}
          <div className="flex-1 relative pb-8" onClick={() => setSelectedClipId(null)}>
            {/* Playhead Line down through tracks */}
            <div 
              className="absolute top-0 bottom-0 w-[1px] bg-accent z-20 pointer-events-none"
              style={{ left: (playheadPosition * zoomLevel) + 64 }}
            />

            {tracks.map((track) => (
              <div
                key={track.id}
                onPointerUp={() => handlePointerUp(track.id)}
                className={`h-[42px] flex items-center relative transition-colors ${
                  draggedItem ? "bg-[#2a2a2a]" : "bg-[#1f1f1f]"
                } border-b border-[#111]`}
              >
                {/* Track Header */}
                <div className="w-16 h-full border-r border-[#111] bg-[#252525] flex items-center px-2 sticky left-0 z-30 shrink-0">
                  <span className="text-[10px] text-[#888] font-medium">{track.name}</span>
                </div>
                
                {/* Track Content */}
                <div className="flex-1 h-full relative">
                  {track.items.map((item, idx) => {
                    // Hybrid Rust Engine for Thumbnails!
                    // This generates a very basic thumbnail using the FFmpeg CLI backend
                    const thumbUrl = item.src ? `kromavideo://localhost/?path=${encodeURIComponent(item.src)}&t=${item.start || 0}` : '';

                    return (
                      <motion.div
                        key={`${item.id}-${idx}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
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
                        className={`absolute h-[34px] top-[4px] flex items-center px-1 shadow-sm border overflow-hidden ${
                          selectedClipId === item.id ? "border-white" : "border-[#111]"
                        } ${activeTool === "razor" ? "cursor-crosshair bg-red-800/80" : "cursor-pointer"}`}
                        style={{
                          left: (item.start || 0) * zoomLevel,
                          width: (item.duration || 0) * zoomLevel,
                          backgroundColor: "#3a689b", // Premiere default video clip color
                          backgroundImage: thumbUrl ? `url(${thumbUrl})` : 'none',
                          backgroundSize: 'cover',
                          backgroundPosition: 'left center',
                          color: "white"
                        }}
                      >
                        {/* Overlay to dim thumbnail */}
                        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
                        <span className="truncate w-full drop-shadow-md pointer-events-none text-[10px] relative z-10 font-medium">
                          {item.name}
                        </span>
                      </motion.div>
                    )
                  })}
                  
                  {draggedItem && (
                    <div className="absolute inset-y-[4px] right-2 left-2 border border-dashed border-[#555] pointer-events-none" />
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

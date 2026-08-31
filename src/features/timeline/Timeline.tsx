import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useEditorStore, DragItem, formatTimecode } from "../../stores/useEditorStore";
import { TimeRuler } from "./TimeRuler";

function PlayheadOverlay({ zoomLevel }: { zoomLevel: number }) {
  const playheadPosition = useEditorStore(state => state.playheadPosition);
  const setPlayheadPosition = useEditorStore(state => state.setPlayheadPosition);

  return (
    <>
      <div className="absolute top-0 left-0 w-full h-6 pointer-events-none z-50">
        <motion.div
          drag="x"
          dragConstraints={{ left: 0 }}
          dragElastic={0}
          dragMomentum={false}
          onDrag={(_, info) => {
            const newX = (playheadPosition * zoomLevel) + info.delta.x;
            setPlayheadPosition(Math.max(0, newX / zoomLevel));
          }}
          className="absolute top-0 w-3 h-full -ml-1.5 bg-accent cursor-ew-resize flex justify-center pointer-events-auto"
          style={{ left: (playheadPosition * zoomLevel) + 64 }}
        >
          <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-accent mt-1" />
          <div className="absolute top-[7px] bottom-0 w-[1px] bg-accent" />
        </motion.div>
      </div>

      <div 
        className="absolute top-6 bottom-0 w-[1px] bg-accent z-20 pointer-events-none"
        style={{ left: (playheadPosition * zoomLevel) + 64 }}
      />
    </>
  );
}

function TimecodeDisplay() {
  const playheadPosition = useEditorStore(state => state.playheadPosition);
  return (
    <span className="text-[9px] text-accent font-mono tracking-wider">{formatTimecode(playheadPosition).substring(3)}</span>
  );
}

export function Timeline() {
  const draggedItem = useEditorStore(state => state.draggedItem);
  const activeTool = useEditorStore(state => state.activeTool);
  const zoomLevel = useEditorStore(state => state.zoomLevel);
  const setZoomLevel = useEditorStore(state => state.setZoomLevel);
  const selectedClipId = useEditorStore(state => state.selectedClipId);
  const setSelectedClipId = useEditorStore(state => state.setSelectedClipId);
  const tracks = useEditorStore(state => state.tracks);
  const setTracks = useEditorStore(state => state.setTracks);
  
  const getPlayheadPosition = () => useEditorStore.getState().playheadPosition;
  const setPlayheadPosition = useEditorStore(state => state.setPlayheadPosition);
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(1000);

  // Custom dragging state for native pointer events!
  const [draggingClip, setDraggingClip] = useState<{ trackId: string; itemIdx: number; initialX: number; initialStart: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);

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

  const handlePointerUpBinDrop = (trackId: string) => {
    // If dropping a new clip from the media bin
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

  // NATIVE CLIP DRAGGING
  const handleClipPointerDown = (e: React.PointerEvent, trackId: string, itemIdx: number, item: DragItem) => {
    e.stopPropagation();
    if (activeTool === "selection") {
      setSelectedClipId(item.id);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragOffset(0);
      setDraggingClip({
        trackId,
        itemIdx,
        initialX: e.clientX,
        initialStart: item.start || 0
      });
    } else if (activeTool === "razor") {
      // Razor tool logic
      setTracks((prev) =>
        prev.map((track) => {
          if (track.id === trackId) {
            const newItems = [...track.items];
            const target = newItems[itemIdx];
            
            let splitPos = getPlayheadPosition();
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

  const handleClipPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingClip) return;
    const deltaX = e.clientX - draggingClip.initialX;
    setDragOffset(deltaX);
  }, [draggingClip]);

  const handleClipPointerUp = useCallback((e: React.PointerEvent) => {
    if (draggingClip) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      
      const deltaSecs = dragOffset / zoomLevel;
      const newStart = Math.max(0, draggingClip.initialStart + deltaSecs);

      setTracks(prev => prev.map(t => {
        if (t.id === draggingClip.trackId) {
          const newItems = [...t.items];
          newItems[draggingClip.itemIdx] = { ...newItems[draggingClip.itemIdx], start: newStart };
          return { ...t, items: newItems };
        }
        return t;
      }));
      
      setDraggingClip(null);
      setDragOffset(0);
    }
  }, [draggingClip, dragOffset, zoomLevel, setTracks]);

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
      <div className="h-6 px-3 flex items-center justify-between bg-[var(--panel-bg)] border-b border-[var(--panel-border)]">
        <span className="text-[11px] font-semibold text-[#ddd]">Timeline: Sequence 01</span>
        <div className="flex items-center gap-2">
          <input 
            type="range" min="10" max="300" value={zoomLevel} 
            onChange={(e) => setZoomLevel(Number(e.target.value))}
            className="w-20 accent-accent" title="Zoom (+ / -)"
          />
        </div>
      </div>

      <div 
        className={`flex-1 relative overflow-x-auto overflow-y-hidden flex flex-col ${getTimelineCursorClass()}`}
        ref={timelineRef}
      >
        <div className="min-w-max relative flex-1 flex flex-col" style={{ width: Math.max(timelineWidth + 64, 3000) }}>
          
          <div className="h-6 border-b border-[var(--panel-border)] bg-[var(--panel-bg)] flex relative cursor-text sticky top-0 z-40" onClick={handleTimelineClick}>
            <div className="w-16 h-full border-r border-[var(--panel-border)] bg-[var(--panel-bg)] sticky left-0 z-50 flex items-center justify-center">
              <TimecodeDisplay />
            </div>
            
            <div className="flex-1 relative overflow-hidden">
              <TimeRuler zoomLevel={zoomLevel} width={Math.max(timelineWidth, 3000)} />
            </div>
          </div>
          
          <PlayheadOverlay zoomLevel={zoomLevel} />
          
          <div className="flex-1 relative pb-8" onClick={() => setSelectedClipId(null)}>
            {tracks.map((track) => (
              <div
                key={track.id}
                onPointerUp={() => handlePointerUpBinDrop(track.id)}
                className={`h-[42px] flex items-center relative transition-colors ${
                  draggedItem ? "bg-[#2a2a2a]" : "bg-[var(--background)]"
                } border-b border-[var(--panel-border)]`}
              >
                <div className="w-16 h-full border-r border-[var(--panel-border)] bg-[var(--panel-bg)] flex items-center px-2 sticky left-0 z-30 shrink-0">
                  <span className="text-[10px] text-[#888] font-medium">{track.name}</span>
                </div>
                
                <div className="flex-1 h-full relative">
                  {track.items.map((item, idx) => {
                    const thumbUrl = item.src ? `kromavideo://localhost/?path=${encodeURIComponent(item.src)}&t=${item.start || 0}` : '';

                    return (
                      <div
                        key={`${item.id}-${idx}`}
                        onPointerDown={(e) => handleClipPointerDown(e, track.id, idx, item)}
                        onPointerMove={handleClipPointerMove}
                        onPointerUp={handleClipPointerUp}
                        onPointerCancel={handleClipPointerUp}
                        className={`absolute h-[34px] top-[4px] flex items-center px-1 shadow-sm border overflow-hidden ${
                          selectedClipId === item.id ? "border-white z-20" : "border-[#111] z-10"
                        } ${activeTool === "razor" ? "cursor-crosshair bg-red-800/80" : "cursor-pointer hover:border-[#aaa]"}`}
                        style={{
                          left: (item.start || 0) * zoomLevel,
                          width: (item.duration || 0) * zoomLevel,
                          backgroundColor: "var(--accent)", 
                          backgroundImage: thumbUrl ? `url(${thumbUrl})` : 'none',
                          backgroundSize: 'cover',
                          backgroundPosition: 'left center',
                          color: "white",
                          transform: draggingClip?.trackId === track.id && draggingClip?.itemIdx === idx ? `translateX(${dragOffset}px)` : 'none'
                        }}
                      >
                        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
                        <span className="truncate w-full drop-shadow-[0_1px_2px_rgba(0,0,0,1)] pointer-events-none text-[10px] relative z-10 font-bold">
                          {item.name}
                        </span>
                      </div>
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

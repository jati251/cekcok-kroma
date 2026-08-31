import { useRef, useEffect, useState, useCallback } from "react";
import { useEditorStore, DragItem, formatTimecode } from "../../stores/useEditorStore";
import { TimeRuler } from "./TimeRuler";

function PlayheadOverlay({ 
  zoomLevel, 
  timelineRef 
}: { 
  zoomLevel: number; 
  timelineRef: React.RefObject<HTMLDivElement | null>;
}) {
  const playheadPosition = useEditorStore(state => state.playheadPosition);
  const setPlayheadPosition = useEditorStore(state => state.setPlayheadPosition);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineRef.current.scrollLeft;
    const x = e.clientX - rect.left + scrollLeft - 64;
    setPlayheadPosition(Math.max(0, x / zoomLevel));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      setIsDragging(false);
    }
  };

  const leftPos = (playheadPosition * zoomLevel) + 64;

  return (
    <div 
      className="absolute top-0 bottom-0 pointer-events-none z-50 flex flex-col items-center select-none"
      style={{ left: leftPos, transform: 'translateX(-50%)' }}
    >
      {/* Playhead Cap (Interactive handle on ruler) */}
      <div 
        className="w-3.5 h-6 bg-accent cursor-ew-resize pointer-events-auto flex flex-col items-center justify-between shadow-lg hover:brightness-125 active:brightness-90 transition-all rounded-t-sm"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        title="Playhead (Scrub)"
      >
        <div className="w-1.5 h-1.5 bg-white/90 rounded-full mt-1" />
        <div className="w-0 h-0 border-l-[7px] border-r-[7px] border-t-[7px] border-l-transparent border-r-transparent border-t-accent" />
      </div>

      {/* Playhead Needle (Vertical Line spanning down across all tracks) */}
      <div className="w-[1px] flex-1 bg-accent shadow-[0_0_4px_rgba(45,140,235,0.8)]" />
    </div>
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
  const setDraggedItem = useEditorStore(state => state.setDraggedItem);
  const activeTool = useEditorStore(state => state.activeTool);
  const zoomLevel = useEditorStore(state => state.zoomLevel);
  const setZoomLevel = useEditorStore(state => state.setZoomLevel);
  const selectedClipId = useEditorStore(state => state.selectedClipId);
  const setSelectedClipId = useEditorStore(state => state.setSelectedClipId);
  const tracks = useEditorStore(state => state.tracks);
  const setTracks = useEditorStore(state => state.setTracks);
  const inPoint = useEditorStore(state => state.inPoint);
  const outPoint = useEditorStore(state => state.outPoint);
  
  const getPlayheadPosition = () => useEditorStore.getState().playheadPosition;
  const setPlayheadPosition = useEditorStore(state => state.setPlayheadPosition);
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(1000);

  // Custom dragging state for moving clips within tracks
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

  // Drop media item from MediaBin onto a track at exact mouse X timestamp
  const handlePointerUpBinDrop = (e: React.PointerEvent, trackId: string) => {
    if (draggedItem && activeTool === "selection") {
      let dropTime = 0;
      if (timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const scrollLeft = timelineRef.current.scrollLeft;
        const x = e.clientX - rect.left + scrollLeft - 64;
        dropTime = Math.max(0, x / zoomLevel);
      }

      setTracks((prev) =>
        prev.map((track) => {
          if (track.id === trackId) {
            const duration = draggedItem.duration || 5; 
            return {
              ...track,
              items: [
                ...track.items,
                { ...draggedItem, id: `${draggedItem.id}-${Date.now()}`, start: dropTime, duration },
              ],
            };
          }
          return track;
        })
      );
      setDraggedItem(null);
    }
  };

  // NATIVE CLIP DRAGGING ON TIMELINE
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

  // Scrubbing directly on the ruler
  const handleRulerScrub = (e: React.PointerEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineRef.current.scrollLeft;
    const x = e.clientX - rect.left + scrollLeft - 64;
    setPlayheadPosition(Math.max(0, x / zoomLevel));
  };

  const handleRulerPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    handleRulerScrub(e);
  };

  const handleRulerPointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 1) {
      handleRulerScrub(e);
    }
  };

  const handleRulerPointerUp = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
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
      {/* Timeline Header Bar */}
      <div className="h-6 px-3 flex items-center justify-between bg-[var(--panel-bg)] border-b border-[var(--panel-border)]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#ddd]">Timeline: Sequence 01</span>
          {inPoint !== null && outPoint !== null && (
            <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.2 rounded font-mono">
              Range: {(outPoint - inPoint).toFixed(2)}s
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-[#666]">Zoom</span>
          <input 
            type="range" min="10" max="300" value={zoomLevel} 
            onChange={(e) => setZoomLevel(Number(e.target.value))}
            className="w-20 accent-accent cursor-pointer" title="Zoom (+ / -)"
          />
        </div>
      </div>

      {/* Main Timeline Body */}
      <div 
        className={`flex-1 relative overflow-x-auto overflow-y-hidden flex flex-col ${getTimelineCursorClass()}`}
        ref={timelineRef}
      >
        <div className="min-w-max relative flex-1 flex flex-col" style={{ width: Math.max(timelineWidth + 64, 3000) }}>
          
          {/* Time Ruler (Interactive Scrubbing) */}
          <div 
            className="h-6 border-b border-[var(--panel-border)] bg-[var(--panel-bg)] flex relative cursor-ew-resize sticky top-0 z-40" 
            onPointerDown={handleRulerPointerDown}
            onPointerMove={handleRulerPointerMove}
            onPointerUp={handleRulerPointerUp}
          >
            {/* Sticky Timecode Display on Left */}
            <div className="w-16 h-full border-r border-[var(--panel-border)] bg-[var(--panel-bg)] sticky left-0 z-50 flex items-center justify-center pointer-events-none">
              <TimecodeDisplay />
            </div>
            
            <div className="flex-1 relative overflow-hidden pointer-events-none">
              <TimeRuler zoomLevel={zoomLevel} width={Math.max(timelineWidth, 3000)} />
            </div>
          </div>
          
          {/* Unified Playhead Overlay */}
          <PlayheadOverlay zoomLevel={zoomLevel} timelineRef={timelineRef} />
          
          {/* Tracks Area */}
          <div className="flex-1 relative pb-8" onClick={() => setSelectedClipId(null)}>
            {tracks.map((track) => (
              <div
                key={track.id}
                onPointerUp={(e) => handlePointerUpBinDrop(e, track.id)}
                className={`h-[42px] flex items-center relative transition-colors ${
                  draggedItem ? "bg-[#252525] ring-1 ring-accent/40" : "bg-[var(--background)]"
                } border-b border-[var(--panel-border)]`}
              >
                {/* Sticky Track Header */}
                <div className="w-16 h-full border-r border-[var(--panel-border)] bg-[var(--panel-bg)] flex items-center justify-between px-2 sticky left-0 z-30 shrink-0 select-none">
                  <span className="text-[10px] text-[#888] font-semibold">{track.name}</span>
                  <div className="flex gap-1 text-[8px] text-[#555]">
                    <button className="hover:text-white" title="Mute">M</button>
                    <button className="hover:text-white" title="Solo">S</button>
                  </div>
                </div>
                
                {/* Track Items Content */}
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
                        className={`absolute h-[34px] top-[4px] flex items-center px-1 shadow-sm border overflow-hidden rounded-[2px] select-none ${
                          selectedClipId === item.id ? "border-white ring-1 ring-accent z-20" : "border-[#111] z-10"
                        } ${activeTool === "razor" ? "cursor-crosshair bg-red-800/80" : "cursor-pointer hover:border-[#aaa]"}`}
                        style={{
                          left: (item.start || 0) * zoomLevel,
                          width: (item.duration || 0) * zoomLevel,
                          backgroundColor: item.color || "var(--accent)", 
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
                    );
                  })}
                  
                  {/* Drop Preview Highlight when dragging from bin */}
                  {draggedItem && (
                    <div className="absolute inset-y-[4px] right-2 left-2 border border-dashed border-accent/60 pointer-events-none bg-accent/5 rounded" />
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

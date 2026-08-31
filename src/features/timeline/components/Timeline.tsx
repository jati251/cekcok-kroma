import { useRef, useEffect, useState, useCallback } from "react";
import { useEditorStore } from "../../../stores/useEditorStore";
import { DragItem } from "../../../types/editor";
import { formatTimecode } from "../../../utils/timecode";
import { TimeRuler } from "./TimeRuler";
import { Playhead } from "./Playhead";
import { TimelineHeader } from "./TimelineHeader";
import { TrackHeader } from "./TrackHeader";
import { TimelineClip } from "./TimelineClip";

export function Timeline() {
  const draggedItem = useEditorStore((state) => state.draggedItem);
  const setDraggedItem = useEditorStore((state) => state.setDraggedItem);
  const activeTool = useEditorStore((state) => state.activeTool);
  const zoomLevel = useEditorStore((state) => state.zoomLevel);
  const setZoomLevel = useEditorStore((state) => state.setZoomLevel);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const setSelectedClipId = useEditorStore((state) => state.setSelectedClipId);
  const tracks = useEditorStore((state) => state.tracks);
  const setTracks = useEditorStore((state) => state.setTracks);
  const inPoint = useEditorStore((state) => state.inPoint);
  const outPoint = useEditorStore((state) => state.outPoint);
  const setPlayheadPosition = useEditorStore((state) => state.setPlayheadPosition);
  const playheadPosition = useEditorStore((state) => state.playheadPosition);

  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(1000);

  // Dragging state for moving clips within tracks
  const [draggingClip, setDraggingClip] = useState<{
    trackId: string;
    itemIdx: number;
    initialX: number;
    initialStart: number;
  } | null>(null);
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

  // Drop media from MediaBin at mouse X timestamp + AUTOMATIC LINKED AUDIO TRACK SPAWN!
  const handlePointerUpBinDrop = (e: React.PointerEvent, trackId: string) => {
    if (draggedItem && activeTool === "selection") {
      let dropTime = 0;
      if (timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const scrollLeft = timelineRef.current.scrollLeft;
        const x = e.clientX - rect.left + scrollLeft - 64;
        dropTime = Math.max(0, x / zoomLevel);
      }

      const duration = draggedItem.duration || 5;
      const baseId = `${draggedItem.id}-${Date.now()}`;
      const videoClipId = `${baseId}-v`;
      const audioClipId = `${baseId}-a`;

      const videoClip: DragItem = {
        ...draggedItem,
        id: videoClipId,
        linkedClipId: audioClipId,
        start: dropTime,
        duration,
        color: "#2d8ceb",
      };

      const audioClip: DragItem = {
        ...draggedItem,
        id: audioClipId,
        linkedClipId: videoClipId,
        name: `${draggedItem.name} [Audio]`,
        start: dropTime,
        duration,
        color: "#10b981", // Emerald green for Premiere Pro audio
        waveform: draggedItem.waveform || [],
      };

      setTracks((prev) =>
        prev.map((track) => {
          if (track.id === trackId) {
            return {
              ...track,
              items: [...track.items, videoClip],
            };
          }
          // Also automatically add linked audio to A1 if dropping on video track and item has audio
          if (track.id === "a1" && trackId.startsWith("v") && draggedItem.hasAudio !== false) {
            return {
              ...track,
              items: [...track.items, audioClip],
            };
          }
          return track;
        })
      );

      setSelectedClipId(videoClipId);
      setDraggedItem(null);
    }
  };

  // Start dragging a clip or cut with razor
  const handleClipPointerDown = (
    e: React.PointerEvent,
    trackId: string,
    itemIdx: number,
    item: DragItem
  ) => {
    e.stopPropagation();
    if (activeTool === "selection") {
      setSelectedClipId(item.id);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragOffset(0);
      setDraggingClip({
        trackId,
        itemIdx,
        initialX: e.clientX,
        initialStart: item.start || 0,
      });
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
              splitPos = start + dur / 2;
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

  const handleClipPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingClip) return;
      const deltaX = e.clientX - draggingClip.initialX;
      setDragOffset(deltaX);
    },
    [draggingClip]
  );

  const handleClipPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (draggingClip) {
        try {
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {}

        const deltaSecs = dragOffset / zoomLevel;
        const newStart = Math.max(0, draggingClip.initialStart + deltaSecs);

        setTracks((prev) =>
          prev.map((t) => {
            if (t.id === draggingClip.trackId) {
              const newItems = [...t.items];
              newItems[draggingClip.itemIdx] = {
                ...newItems[draggingClip.itemIdx],
                start: newStart,
              };
              return { ...t, items: newItems };
            }
            return t;
          })
        );

        setDraggingClip(null);
        setDragOffset(0);
      }
    },
    [draggingClip, dragOffset, zoomLevel, setTracks]
  );

  // Ruler scrubbing handler
  const handleRulerScrub = (e: React.PointerEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineRef.current.scrollLeft;
    const x = e.clientX - rect.left + scrollLeft - 64;
    setPlayheadPosition(Math.max(0, x / zoomLevel));
  };

  const getTimelineCursorClass = () => {
    switch (activeTool) {
      case "razor":
        return "cursor-crosshair";
      case "hand":
        return "cursor-grab active:cursor-grabbing";
      default:
        return "cursor-default";
    }
  };

  return (
    <div className="flex-1 bg-[var(--panel-bg)] flex flex-col relative select-none border border-[var(--panel-border)] overflow-hidden">
      <TimelineHeader
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        inPoint={inPoint}
        outPoint={outPoint}
      />

      <div
        className={`flex-1 relative overflow-x-auto overflow-y-hidden flex flex-col ${getTimelineCursorClass()}`}
        ref={timelineRef}
      >
        <div
          className="min-w-max relative flex-1 flex flex-col"
          style={{ width: Math.max(timelineWidth + 64, 3000) }}
        >
          {/* Time Ruler Bar */}
          <div
            className="h-6 border-b border-[var(--panel-border)] bg-[var(--panel-bg)] flex relative cursor-ew-resize sticky top-0 z-40"
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              handleRulerScrub(e);
            }}
            onPointerMove={(e) => e.buttons === 1 && handleRulerScrub(e)}
            onPointerUp={(e) => {
              try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
              } catch {}
            }}
          >
            <div className="w-16 h-full border-r border-[var(--panel-border)] bg-[var(--panel-bg)] sticky left-0 z-50 flex items-center justify-center pointer-events-none">
              <span className="text-[9px] text-accent font-mono tracking-wider">
                {formatTimecode(playheadPosition).substring(3)}
              </span>
            </div>

            <div className="flex-1 relative overflow-hidden pointer-events-none">
              <TimeRuler zoomLevel={zoomLevel} width={Math.max(timelineWidth, 3000)} />

              {/* Shaded In/Out Range Highlight */}
              {inPoint !== null && outPoint !== null && (
                <div
                  className="absolute top-0 bottom-0 bg-accent/20 border-x border-accent/80 pointer-events-none"
                  style={{
                    left: inPoint * zoomLevel,
                    width: Math.max(2, (outPoint - inPoint) * zoomLevel),
                  }}
                />
              )}
            </div>
          </div>

          {/* Unified Playhead */}
          <Playhead zoomLevel={zoomLevel} timelineRef={timelineRef} />

          {/* Tracks Area */}
          <div
            className="flex-1 relative pb-8"
            onClick={(e) => {
              // Only deselect if clicked directly on track background, not on clips
              if (e.target === e.currentTarget) {
                setSelectedClipId(null);
              }
            }}
          >
            {tracks.map((track) => (
              <div
                key={track.id}
                onPointerUp={(e) => handlePointerUpBinDrop(e, track.id)}
                className={`h-[42px] flex items-center relative transition-colors ${
                  draggedItem ? "bg-[#252525] ring-1 ring-accent/40" : "bg-[var(--background)]"
                } border-b border-[var(--panel-border)]`}
              >
                <TrackHeader name={track.name} />

                <div className="flex-1 h-full relative">
                  {track.items.map((item, idx) => (
                    <TimelineClip
                      key={`${item.id}-${idx}`}
                      item={item}
                      trackId={track.id}
                      itemIndex={idx}
                      zoomLevel={zoomLevel}
                      isSelected={selectedClipId === item.id}
                      activeTool={activeTool}
                      isBeingDragged={
                        draggingClip?.trackId === track.id && draggingClip?.itemIdx === idx
                      }
                      dragOffset={dragOffset}
                      onPointerDown={(e) => handleClipPointerDown(e, track.id, idx, item)}
                      onPointerMove={handleClipPointerMove}
                      onPointerUp={handleClipPointerUp}
                    />
                  ))}

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

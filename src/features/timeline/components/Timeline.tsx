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

  // 2D Dragging state for clips (horizontal time + vertical track switching)
  const [draggingClip, setDraggingClip] = useState<{
    trackId: string;
    itemIdx: number;
    initialX: number;
    initialY: number;
    initialStart: number;
    linkedClipId?: string;
  } | null>(null);

  const [dragOffset, setDragOffset] = useState<number>(0);
  const [targetTrackId, setTargetTrackId] = useState<string | null>(null);

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

  // Drop media from MediaBin at mouse X timestamp + AUTOMATIC LINKED AUDIO TRACK SPAWN
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
        trimIn: 0,
        color: "#2d8ceb",
      };

      const audioClip: DragItem = {
        ...draggedItem,
        id: audioClipId,
        linkedClipId: videoClipId,
        name: `${draggedItem.name} [Audio]`,
        start: dropTime,
        duration,
        trimIn: 0,
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

  // Start 2D dragging a clip or razor cut
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
      setTargetTrackId(trackId);
      setDraggingClip({
        trackId,
        itemIdx,
        initialX: e.clientX,
        initialY: e.clientY,
        initialStart: item.start || 0,
        linkedClipId: item.linkedClipId,
      });
    } else if (activeTool === "razor") {
      // Linked Razor Cut: Cut both video and linked audio clip at the exact playhead position
      setTracks((prev) => {
        let nextTracks = prev.map((track) => {
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

            const clipA: DragItem = { ...target, id: `${target.id}-a1`, duration: durA };
            const clipB: DragItem = {
              ...target,
              id: `${target.id}-b1`,
              start: splitPos,
              duration: durB,
              trimIn: (target.trimIn || 0) + durA,
            };

            newItems.splice(itemIdx, 1, clipA, clipB);
            return { ...track, items: newItems };
          }
          return track;
        });

        // Also cut linked clip on the other track
        if (item.linkedClipId) {
          nextTracks = nextTracks.map((track) => {
            const linkedIdx = track.items.findIndex((i) => i.id === item.linkedClipId);
            if (linkedIdx !== -1) {
              const newItems = [...track.items];
              const linkedTarget = newItems[linkedIdx];

              let splitPos = playheadPosition;
              const start = linkedTarget.start || 0;
              const dur = linkedTarget.duration || 0;

              if (splitPos <= start || splitPos >= start + dur) {
                splitPos = start + dur / 2;
              }

              const durA = splitPos - start;
              const durB = dur - durA;

              const linkedA: DragItem = { ...linkedTarget, id: `${linkedTarget.id}-a2`, duration: durA };
              const linkedB: DragItem = {
                ...linkedTarget,
                id: `${linkedTarget.id}-b2`,
                start: splitPos,
                duration: durB,
                trimIn: (linkedTarget.trimIn || 0) + durA,
              };

              newItems.splice(linkedIdx, 1, linkedA, linkedB);
              return { ...track, items: newItems };
            }
            return track;
          });
        }

        return nextTracks;
      });
    }
  };

  // 2D Dragging Movement (Horizontal Delta + Vertical Track Switching)
  const handleClipPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingClip) return;
      const deltaX = e.clientX - draggingClip.initialX;
      const deltaY = e.clientY - draggingClip.initialY;

      setDragOffset(deltaX);

      // Track height is 42px. Determine if user dragged up or down between tracks!
      const currentTrackIndex = tracks.findIndex((t) => t.id === draggingClip.trackId);
      const trackDelta = Math.round(deltaY / 42);
      const newTrackIndex = currentTrackIndex + trackDelta;

      if (newTrackIndex >= 0 && newTrackIndex < tracks.length) {
        const sourceTrack = tracks[currentTrackIndex];
        const destTrack = tracks[newTrackIndex];

        // Keep video on video tracks (V1, V2) and audio on audio tracks (A1)
        if (sourceTrack.type === destTrack.type) {
          setTargetTrackId(destTrack.id);
        }
      }
    },
    [draggingClip, tracks]
  );

  // 2D Drag Drop Finalization (Update Time + Track Location in tandem with Linked Audio)
  const handleClipPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (draggingClip) {
        try {
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {}

        const deltaSecs = dragOffset / zoomLevel;
        const newStart = Math.max(0, draggingClip.initialStart + deltaSecs);
        const finalDestTrackId = targetTrackId || draggingClip.trackId;

        setTracks((prev) => {
          // Find dragged item
          let movingItem: DragItem | null = null;
          const updatedTracks = prev.map((track) => {
            if (track.id === draggingClip.trackId) {
              const item = track.items[draggingClip.itemIdx];
              if (item) {
                movingItem = { ...item, start: newStart };
              }
              // If moving to another track, remove from current
              if (finalDestTrackId !== draggingClip.trackId) {
                return {
                  ...track,
                  items: track.items.filter((_, idx) => idx !== draggingClip.itemIdx),
                };
              } else {
                const newItems = [...track.items];
                newItems[draggingClip.itemIdx] = movingItem!;
                return { ...track, items: newItems };
              }
            }
            return track;
          });

          // Insert into destination track if changed
          let result = updatedTracks;
          if (finalDestTrackId !== draggingClip.trackId && movingItem) {
            result = result.map((track) => {
              if (track.id === finalDestTrackId) {
                return {
                  ...track,
                  items: [...track.items, movingItem!],
                };
              }
              return track;
            });
          }

          // SYNC LINKED AUDIO: Also shift linked audio clip by the exact same deltaSecs!
          if (draggingClip.linkedClipId) {
            result = result.map((track) => ({
              ...track,
              items: track.items.map((item) =>
                item.id === draggingClip.linkedClipId
                  ? { ...item, start: Math.max(0, (item.start || 0) + deltaSecs) }
                  : item
              ),
            }));
          }

          return result;
        });

        setDraggingClip(null);
        setDragOffset(0);
        setTargetTrackId(null);
      }
    },
    [draggingClip, dragOffset, zoomLevel, targetTrackId, setTracks]
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

              {/* Shaded In/Out Range Highlight on Ruler */}
              {inPoint !== null && outPoint !== null && (
                <div
                  className="absolute top-0 bottom-0 bg-accent/25 border-x-2 border-accent pointer-events-none flex justify-between"
                  style={{
                    left: inPoint * zoomLevel,
                    width: Math.max(2, (outPoint - inPoint) * zoomLevel),
                  }}
                >
                  <span className="text-[8px] font-bold text-accent pl-0.5">&#123;</span>
                  <span className="text-[8px] font-bold text-accent pr-0.5">&#125;</span>
                </div>
              )}
            </div>
          </div>

          {/* Unified Playhead */}
          <Playhead zoomLevel={zoomLevel} timelineRef={timelineRef} />

          {/* Tracks Area */}
          <div
            className="flex-1 relative pb-8"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedClipId(null);
              }
            }}
          >
            {tracks.map((track) => {
              const isDropTarget = targetTrackId === track.id && draggingClip?.trackId !== track.id;

              return (
                <div
                  key={track.id}
                  onPointerUp={(e) => handlePointerUpBinDrop(e, track.id)}
                  className={`h-[42px] flex items-center relative transition-colors ${
                    isDropTarget
                      ? "bg-accent/20 ring-1 ring-accent"
                      : draggedItem
                      ? "bg-[#252525] ring-1 ring-accent/40"
                      : "bg-[var(--background)]"
                  } border-b border-[var(--panel-border)]`}
                >
                  <TrackHeader name={track.name} />

                  <div className="flex-1 h-full relative">
                    {track.items.map((item, idx) => {
                      const isThisDragged =
                        draggingClip?.trackId === track.id && draggingClip?.itemIdx === idx;
                      const isLinkedToDragged =
                        draggingClip?.linkedClipId === item.id;

                      return (
                        <TimelineClip
                          key={`${item.id}-${idx}`}
                          item={item}
                          trackId={track.id}
                          itemIndex={idx}
                          zoomLevel={zoomLevel}
                          isSelected={selectedClipId === item.id}
                          activeTool={activeTool}
                          isBeingDragged={isThisDragged || isLinkedToDragged}
                          dragOffset={dragOffset}
                          onPointerDown={(e) => handleClipPointerDown(e, track.id, idx, item)}
                          onPointerMove={handleClipPointerMove}
                          onPointerUp={handleClipPointerUp}
                        />
                      );
                    })}

                    {draggedItem && (
                      <div className="absolute inset-y-[4px] right-2 left-2 border border-dashed border-accent/60 pointer-events-none bg-accent/5 rounded" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useRef, useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useEditorStore } from "../../../stores/useEditorStore";
import { DragItem } from "../../../types/editor";
import { formatTimecode } from "../../../utils/timecode";
import { calculateSnapPosition } from "../utils/snapHelper";
import { TimeRuler } from "./TimeRuler";
import { Playhead } from "./Playhead";
import { TimelineHeader } from "./TimelineHeader";
import { TrackHeader } from "./TrackHeader";
import { TimelineClip } from "./TimelineClip";

function PlayheadTimeDisplay() {
  const playheadPosition = useEditorStore((state) => state.playheadPosition);
  return (
    <span className="text-[9px] text-accent font-mono tracking-wider">
      {formatTimecode(playheadPosition).substring(3)}
    </span>
  );
}

export function Timeline() {
  const draggedItem = useEditorStore((state) => state.draggedItem);
  const setDraggedItem = useEditorStore((state) => state.setDraggedItem);
  const activeTool = useEditorStore((state) => state.activeTool);
  const zoomLevel = useEditorStore((state) => state.zoomLevel);
  const setZoomLevel = useEditorStore((state) => state.setZoomLevel);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const setSelectedClipId = useEditorStore((state) => state.setSelectedClipId);
  const tracks = useEditorStore((state) => state.tracks);
  const fetchState = useEditorStore((state) => state.fetchState);
  const toggleTrackLock = useEditorStore((state) => state.toggleTrackLock);
  const toggleTrackMute = useEditorStore((state) => state.toggleTrackMute);
  const linkedSelection = useEditorStore((state) => state.linkedSelection);
  const isSnapping = useEditorStore((state) => state.isSnapping);
  const inPoint = useEditorStore((state) => state.inPoint);
  const outPoint = useEditorStore((state) => state.outPoint);
  const setPlayheadPosition = useEditorStore((state) => state.setPlayheadPosition);

  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(1000);

  // Visual Guide Lines
  const [razorHoverTime, setRazorHoverTime] = useState<number | null>(null);
  const [snapGuideTime, setSnapGuideTime] = useState<number | null>(null);

  // 2D Dragging state for clips
  const [draggingClip, setDraggingClip] = useState<{
    trackId: string;
    itemIdx: number;
    clipId: string;
    duration: number;
    initialX: number;
    initialY: number;
    initialStart: number;
    linkedClipId?: string;
  } | null>(null);

  const [dragOffset, setDragOffset] = useState<number>(0);
  const [targetTrackId, setTargetTrackId] = useState<string | null>(null);

  // Clip Edge Trimming State
  const [trimmingClip, setTrimmingClip] = useState<{
    trackId: string;
    itemIdx: number;
    edge: "left" | "right";
    initialX: number;
    initialStart: number;
    initialDuration: number;
    initialTrimIn: number;
    linkedClipId?: string;
  } | null>(null);

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

  // Drop media from MediaBin at mouse X timestamp
  const handlePointerUpBinDrop = async (e: React.PointerEvent, trackId: string) => {
    const targetTrack = tracks.find((t) => t.id === trackId);
    if (targetTrack?.isLocked) return;

    if (draggedItem && activeTool === "selection") {
      let dropTime = 0;
      if (timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const scrollLeft = timelineRef.current.scrollLeft;
        const x = e.clientX - rect.left + scrollLeft - 64;
        dropTime = Math.max(0, x / zoomLevel);

        // Snap drop time if snapping is active
        if (isSnapping) {
          const snap = calculateSnapPosition({
            candidateStart: dropTime,
            duration: draggedItem.duration || 5,
            tracks,
            playheadPosition: useEditorStore.getState().playheadPosition,
            inPoint,
            outPoint,
            zoomLevel,
          });
          dropTime = snap.snappedStart;
        }
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
        color: "#10b981",
        waveform: draggedItem.waveform || [],
      };

      try {
        await invoke("drop_clip_to_timeline", {
          trackId,
          videoClip,
          audioClip: draggedItem.hasAudio !== false ? audioClip : null
        });
        
        await fetchState();
        setSelectedClipId(videoClipId);
        setDraggedItem(null);
        setSnapGuideTime(null);
      } catch (err) {
        console.error("Failed to drop clip:", err);
      }
    }
  };

  // Start 2D dragging a clip OR Cut at Mouse Position with Razor tool
  const handleClipPointerDown = (
    e: React.PointerEvent,
    trackId: string,
    itemIdx: number,
    item: DragItem
  ) => {
    e.stopPropagation();
    const track = tracks.find((t) => t.id === trackId);
    if (track?.isLocked) return;

    if (activeTool === "selection") {
      setSelectedClipId(item.id);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragOffset(0);
      setTargetTrackId(trackId);
      setDraggingClip({
        trackId,
        itemIdx,
        clipId: item.id,
        duration: item.duration || 5,
        initialX: e.clientX,
        initialY: e.clientY,
        initialStart: item.start || 0,
        linkedClipId: linkedSelection ? item.linkedClipId : undefined,
      });
    } else if (activeTool === "razor") {
      // CUT AT EXACT MOUSE CLICK POSITION
      const currentPlayhead = useEditorStore.getState().playheadPosition;
      let clickTime = currentPlayhead;
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const start = item.start || 0;
      const dur = item.duration || 5;
      clickTime = start + clickX / zoomLevel;

      if (clickTime <= start + 0.05 || clickTime >= start + dur - 0.05) {
        return;
      }

      invoke("split_clip_cmd", {
        clipId: item.id,
        timestamp: clickTime,
        linkedSelection,
      })
        .then(() => fetchState())
        .catch((err) => console.error("Failed to split clip:", err));
    }
  };

  // Start trimming clip edge
  const handleTrimStart = (
    e: React.PointerEvent,
    trackId: string,
    itemIdx: number,
    item: DragItem,
    edge: "left" | "right"
  ) => {
    e.stopPropagation();
    const track = tracks.find((t) => t.id === trackId);
    if (track?.isLocked) return;

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setTrimmingClip({
      trackId,
      itemIdx,
      edge,
      initialX: e.clientX,
      initialStart: item.start || 0,
      initialDuration: item.duration || 5,
      initialTrimIn: item.trimIn || 0,
      linkedClipId: linkedSelection ? item.linkedClipId : undefined,
    });
  };

  // Trimming movement (Local visual override)
  const handleTrimMove = useCallback(
    (_e: React.PointerEvent) => {
      // Intentionally left empty. For a Rust-first engine,
      // we only submit the trim on pointer up to avoid 60fps IPC serialization lag.
      // A local preview override could be implemented here using a local React state.
    },
    []
  );

  const handleTrimEnd = useCallback(
    async (e: React.PointerEvent) => {
      if (trimmingClip) {
        try {
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {}

        const deltaX = e.clientX - trimmingClip.initialX;
        const deltaSecs = deltaX / zoomLevel;

        try {
          await invoke("trim_clip_cmd", {
            clipId: tracks.find(t => t.id === trimmingClip.trackId)?.items[trimmingClip.itemIdx]?.id,
            edge: trimmingClip.edge,
            deltaSecs,
            linkedSelection,
          });
          await fetchState();
        } catch (err) {
          console.error("Failed to trim clip:", err);
        }

        setTrimmingClip(null);
        setSnapGuideTime(null);
      }
    },
    [trimmingClip, zoomLevel, tracks, linkedSelection, fetchState]
  );

  // 2D Dragging Movement WITH PREMIERE PRO MAGNET SNAPPING!
  const handleClipPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (trimmingClip) {
        handleTrimMove(e);
        return;
      }
      if (!draggingClip) return;

      const deltaX = e.clientX - draggingClip.initialX;
      const deltaY = e.clientY - draggingClip.initialY;

      let effectiveDeltaX = deltaX;

      // PREMIERE PRO MAGNET SNAPPING SYSTEM
      if (isSnapping) {
        const rawStart = Math.max(0, draggingClip.initialStart + deltaX / zoomLevel);
        const snap = calculateSnapPosition({
          candidateStart: rawStart,
          duration: draggingClip.duration,
          tracks,
          excludeClipId: draggingClip.clipId,
          excludeLinkedId: draggingClip.linkedClipId,
          playheadPosition: useEditorStore.getState().playheadPosition,
          inPoint,
          outPoint,
          zoomLevel,
        });

        effectiveDeltaX = (snap.snappedStart - draggingClip.initialStart) * zoomLevel;
        setSnapGuideTime(snap.snapLineTime);
      } else {
        setSnapGuideTime(null);
      }

      setDragOffset(effectiveDeltaX);

      // Track height is 42px: cross-track switching
      const currentTrackIndex = tracks.findIndex((t) => t.id === draggingClip.trackId);
      const trackDelta = Math.round(deltaY / 42);
      const newTrackIndex = currentTrackIndex + trackDelta;

      const sourceTrack = tracks[currentTrackIndex];
      
      if (newTrackIndex < 0 && sourceTrack.type === "video") {
        setTargetTrackId("NEW_VIDEO_TRACK");
      } else if (newTrackIndex >= tracks.length && sourceTrack.type === "audio") {
        setTargetTrackId("NEW_AUDIO_TRACK");
      } else if (newTrackIndex >= 0 && newTrackIndex < tracks.length) {
        const destTrack = tracks[newTrackIndex];
        if (!destTrack.isLocked && sourceTrack.type === destTrack.type) {
          setTargetTrackId(destTrack.id);
        }
      }
    },
    [draggingClip, trimmingClip, handleTrimMove, isSnapping, zoomLevel, tracks, inPoint, outPoint]
  );

  // 2D Drag Drop Finalization
  const handleClipPointerUp = useCallback(
    async (e: React.PointerEvent) => {
      if (trimmingClip) {
        handleTrimEnd(e);
        return;
      }

      if (draggingClip) {
        try {
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {}

        const deltaSecs = dragOffset / zoomLevel;
        const newStart = Math.max(0, draggingClip.initialStart + deltaSecs);
        const finalDestTrackId = targetTrackId || draggingClip.trackId;

        // Locate the moving item
        const track = tracks.find(t => t.id === draggingClip.trackId);
        const item = track?.items[draggingClip.itemIdx];

        if (item) {
          const movingItem = { ...item, start: newStart };
          let audioClip: DragItem | undefined = undefined;

          // If linked selection is on, find the linked clip and move it too
          if (linkedSelection && item.linkedClipId) {
            for (const t of tracks) {
              if (t.isLocked) continue;
              const linked = t.items.find(i => i.id === item.linkedClipId);
              if (linked) {
                audioClip = { ...linked, start: Math.max(0, (linked.start || 0) + deltaSecs) };
                break;
              }
            }
          }

          try {
            await invoke("drop_clip_to_timeline", {
              trackId: finalDestTrackId,
              videoClip: movingItem,
              audioClip: audioClip || null
            });
            await fetchState();
          } catch (err) {
            console.error("Failed to move clip:", err);
          }
        }

        setDraggingClip(null);
        setDragOffset(0);
        setTargetTrackId(null);
        setSnapGuideTime(null);
      }
    },
    [draggingClip, trimmingClip, handleTrimEnd, dragOffset, zoomLevel, targetTrackId, linkedSelection, tracks, fetchState]
  );

  // Ruler scrubbing handler
  const handleRulerScrub = (e: React.PointerEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineRef.current.scrollLeft;
    const x = e.clientX - rect.left + scrollLeft - 64;
    setPlayheadPosition(Math.max(0, x / zoomLevel));
  };

  // Track razor cutting position when mouse moves across timeline
  const handleTimelinePointerMove = (e: React.PointerEvent) => {
    if (activeTool === "razor" && timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const scrollLeft = timelineRef.current.scrollLeft;
      const mouseX = e.clientX - rect.left + scrollLeft - 64;
      setRazorHoverTime(Math.max(0, mouseX / zoomLevel));
    }
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
        onPointerMove={handleTimelinePointerMove}
        onPointerLeave={() => {
          setRazorHoverTime(null);
          setSnapGuideTime(null);
        }}
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
              <PlayheadTimeDisplay />
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

          {/* Magnet Snap Indicator Guide Line (Cyan Glow) */}
          {snapGuideTime !== null && (
            <div
              className="absolute top-6 bottom-0 w-[1.5px] bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,1)] z-40 pointer-events-none flex flex-col items-center animate-pulse"
              style={{ left: snapGuideTime * zoomLevel + 64 }}
            >
              <div className="w-2 h-2 bg-cyan-400 rotate-45 -mt-1 shadow" />
            </div>
          )}

          {/* Laser Razor Cut Line (Red Glow) */}
          {activeTool === "razor" && razorHoverTime !== null && (
            <div
              className="absolute top-6 bottom-0 w-[1.5px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)] z-40 pointer-events-none flex flex-col items-center"
              style={{ left: razorHoverTime * zoomLevel + 64 }}
            >
              <div className="w-2 h-2 bg-red-500 rotate-45 -mt-1 shadow" />
              <div className="text-[8px] font-mono bg-red-950 text-red-200 px-1 py-0.5 rounded border border-red-500/50 mt-1 shadow-md whitespace-nowrap">
                {formatTimecode(razorHoverTime).substring(3)}
              </div>
            </div>
          )}

          {/* Tracks Area */}
          <div
            className="flex-1 relative pb-16"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedClipId(null);
            }}
          >
            {/* NEW VIDEO TRACK DROP ZONE (Top) */}
            {(targetTrackId === "NEW_VIDEO_TRACK" || draggedItem) && (
              <div
                onPointerUp={(e) => handlePointerUpBinDrop(e, "NEW_VIDEO_TRACK")}
                className={`h-[42px] flex items-center justify-center border-b border-dashed border-accent/40 ${
                  targetTrackId === "NEW_VIDEO_TRACK" ? "bg-accent/20" : "bg-transparent"
                } transition-colors`}
              >
                <span className="text-xs text-accent/60 font-medium">
                  + Drop to Create New Video Track
                </span>
              </div>
            )}
            {tracks.map((track) => {
              const isDropTarget = targetTrackId === track.id && draggingClip?.trackId !== track.id;

              return (
                <div
                  key={track.id}
                  onPointerUp={(e) => handlePointerUpBinDrop(e, track.id)}
                  className={`h-[42px] flex items-center relative transition-colors ${
                    track.isLocked
                      ? "bg-[repeating-linear-gradient(45deg,#1c1c1c,#1c1c1c_10px,#242424_10px,#242424_20px)] opacity-85"
                      : isDropTarget
                      ? "bg-accent/20 ring-1 ring-accent"
                      : draggedItem
                      ? "bg-[#252525] ring-1 ring-accent/40"
                      : "bg-[var(--background)]"
                  } border-b border-[var(--panel-border)]`}
                >
                  <TrackHeader
                    name={track.name}
                    isLocked={track.isLocked}
                    isMuted={track.isMuted}
                    onToggleLock={() => toggleTrackLock(track.id)}
                    onToggleMute={() => toggleTrackMute(track.id)}
                  />

                  <div className="flex-1 h-full relative">
                    {track.items.map((item, idx) => {
                      const isThisDragged =
                        draggingClip?.trackId === track.id && draggingClip?.itemIdx === idx;
                      const isLinkedToDragged =
                        linkedSelection &&
                        draggingClip?.linkedClipId === item.id &&
                        !track.isLocked;

                      return (
                        <TimelineClip
                          key={`${item.id}-${idx}`}
                          item={item}
                          trackId={track.id}
                          itemIndex={idx}
                          zoomLevel={zoomLevel}
                          isSelected={selectedClipId === item.id}
                          activeTool={activeTool}
                          isTrackLocked={track.isLocked}
                          isBeingDragged={isThisDragged || isLinkedToDragged}
                          dragOffset={dragOffset}
                          onPointerDown={(e) => handleClipPointerDown(e, track.id, idx, item)}
                          onPointerMove={handleClipPointerMove}
                          onPointerUp={handleClipPointerUp}
                          onTrimStart={(e, edge) => handleTrimStart(e, track.id, idx, item, edge)}
                        />
                      );
                    })}

                    {draggedItem && !track.isLocked && (
                      <div className="absolute inset-y-[4px] right-2 left-2 border border-dashed border-accent/60 pointer-events-none bg-accent/5 rounded" />
                    )}
                  </div>
                </div>
              );
            })}

            {/* NEW AUDIO TRACK DROP ZONE (Bottom) */}
            {(targetTrackId === "NEW_AUDIO_TRACK" || draggedItem) && (
              <div
                onPointerUp={(e) => handlePointerUpBinDrop(e, "NEW_AUDIO_TRACK")}
                className={`h-[42px] flex items-center justify-center border-t border-dashed border-emerald-500/40 ${
                  targetTrackId === "NEW_AUDIO_TRACK" ? "bg-emerald-500/20" : "bg-transparent"
                } transition-colors`}
              >
                <span className="text-xs text-emerald-500/60 font-medium">
                  + Drop to Create New Audio Track
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

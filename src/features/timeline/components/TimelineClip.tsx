import { DragItem, Tool } from "../../../types/editor";

interface TimelineClipProps {
  item: DragItem;
  trackId: string;
  itemIndex: number;
  zoomLevel: number;
  isSelected: boolean;
  activeTool: Tool;
  isTrackLocked?: boolean;
  isBeingDragged: boolean;
  dragOffset: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onTrimStart: (e: React.PointerEvent, edge: "left" | "right") => void;
}

export function TimelineClip({
  item,
  trackId,
  zoomLevel,
  isSelected,
  activeTool,
  isTrackLocked,
  isBeingDragged,
  dragOffset,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onTrimStart,
}: TimelineClipProps) {
  const isAudio = trackId.startsWith("a") || item.color === "#10b981";

  const thumbUrl =
    !isAudio && item.src
      ? `kromavideo://localhost/?path=${encodeURIComponent(item.src)}&t=${(item.trimIn || 0)}`
      : "";

  const cursorClass = isTrackLocked
    ? "cursor-not-allowed opacity-75"
    : activeTool === "razor"
    ? "cursor-crosshair bg-red-800/80"
    : "cursor-pointer hover:border-[#aaa]";

  const clipBg = isAudio ? "#064e3b" : item.color || "var(--accent)";

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onPointerDown={isTrackLocked ? undefined : onPointerDown}
      onPointerMove={isTrackLocked ? undefined : onPointerMove}
      onPointerUp={isTrackLocked ? undefined : onPointerUp}
      onPointerCancel={isTrackLocked ? undefined : onPointerUp}
      className={`absolute h-[34px] top-[4px] flex items-center px-1 shadow-sm border overflow-hidden rounded-[2px] select-none group ${
        isSelected ? "border-white ring-1 ring-accent z-20" : "border-[#111] z-10"
      } ${cursorClass}`}
      style={{
        left: (item.start || 0) * zoomLevel,
        width: Math.max(8, (item.duration || 0) * zoomLevel),
        backgroundColor: clipBg,
        backgroundImage: thumbUrl ? `url(${thumbUrl})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "left center",
        color: "white",
        transform: isBeingDragged && !isTrackLocked ? `translateX(${dragOffset}px)` : "none",
      }}
    >
      {/* Dim Overlay */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />

      {/* Audio Waveform Visualization */}
      {isAudio && (
        <div className="absolute inset-0 pointer-events-none flex items-center px-1">
          <div className="w-full h-[1px] bg-emerald-400/40 absolute left-0" />
          <div className="w-full h-full flex items-center justify-between gap-[1px] py-1">
            {(item.waveform && item.waveform.length > 0
              ? item.waveform
              : [0.3, 0.6, 0.8, 0.4, 0.7, 0.9, 0.5, 0.3, 0.6, 0.8, 0.4, 0.7]
            ).map((amp, idx) => (
              <div
                key={idx}
                className="w-1 bg-emerald-400/80 rounded-full"
                style={{ height: `${Math.max(10, Math.min(100, amp * 100))}%` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Clip Name Label */}
      <span className="truncate w-full drop-shadow-[0_1px_2px_rgba(0,0,0,1)] pointer-events-none text-[10px] relative z-10 font-bold flex items-center gap-1">
        {isAudio && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
        {item.name}
      </span>

      {/* Interactive Left Trim Handle (Trim In) */}
      {!isTrackLocked && activeTool === "selection" && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            onTrimStart(e, "left");
          }}
          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-accent/80 active:bg-accent flex items-center justify-center z-30 transition-colors"
          title="Trim In (Shorten/Lengthen Start)"
        >
          <div className="w-0.5 h-3 bg-white/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

      {/* Interactive Right Trim Handle (Trim Out) */}
      {!isTrackLocked && activeTool === "selection" && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            onTrimStart(e, "right");
          }}
          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-accent/80 active:bg-accent flex items-center justify-center z-30 transition-colors"
          title="Trim Out (Shorten/Lengthen End)"
        >
          <div className="w-0.5 h-3 bg-white/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}
    </div>
  );
}

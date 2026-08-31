import { DragItem, Tool } from "../../../types/editor";

interface TimelineClipProps {
  item: DragItem;
  trackId: string;
  itemIndex: number;
  zoomLevel: number;
  isSelected: boolean;
  activeTool: Tool;
  isBeingDragged: boolean;
  dragOffset: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

export function TimelineClip({
  item,
  trackId,
  zoomLevel,
  isSelected,
  activeTool,
  isBeingDragged,
  dragOffset,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: TimelineClipProps) {
  const isAudio = trackId.startsWith("a") || item.color === "#10b981";

  const thumbUrl =
    !isAudio && item.src
      ? `kromavideo://localhost/?path=${encodeURIComponent(item.src)}&t=${item.start || 0}`
      : "";

  const cursorClass =
    activeTool === "razor"
      ? "cursor-crosshair bg-red-800/80"
      : "cursor-pointer hover:border-[#aaa]";

  const clipBg = isAudio ? "#064e3b" : item.color || "var(--accent)";

  return (
    <div
      onClick={(e) => e.stopPropagation()} // CRITICAL: Stop propagation so container onClick doesn't deselect!
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`absolute h-[34px] top-[4px] flex items-center px-1 shadow-sm border overflow-hidden rounded-[2px] select-none ${
        isSelected ? "border-white ring-1 ring-accent z-20" : "border-[#111] z-10"
      } ${cursorClass}`}
      style={{
        left: (item.start || 0) * zoomLevel,
        width: (item.duration || 0) * zoomLevel,
        backgroundColor: clipBg,
        backgroundImage: thumbUrl ? `url(${thumbUrl})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "left center",
        color: "white",
        transform: isBeingDragged ? `translateX(${dragOffset}px)` : "none",
      }}
    >
      {/* Dim Overlay */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />

      {/* Audio Waveform Canvas for Audio Clips */}
      {isAudio && (
        <div className="absolute inset-0 pointer-events-none flex items-center px-1">
          {/* Baseline */}
          <div className="w-full h-[1px] bg-emerald-400/40 absolute left-0" />
          {/* Waveform bars */}
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
    </div>
  );
}

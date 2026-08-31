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
  zoomLevel,
  isSelected,
  activeTool,
  isBeingDragged,
  dragOffset,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: TimelineClipProps) {
  const thumbUrl = item.src
    ? `kromavideo://localhost/?path=${encodeURIComponent(item.src)}&t=${item.start || 0}`
    : "";

  const cursorClass =
    activeTool === "razor"
      ? "cursor-crosshair bg-red-800/80"
      : "cursor-pointer hover:border-[#aaa]";

  return (
    <div
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
        backgroundColor: item.color || "var(--accent)",
        backgroundImage: thumbUrl ? `url(${thumbUrl})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "left center",
        color: "white",
        transform: isBeingDragged ? `translateX(${dragOffset}px)` : "none",
      }}
    >
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      <span className="truncate w-full drop-shadow-[0_1px_2px_rgba(0,0,0,1)] pointer-events-none text-[10px] relative z-10 font-bold">
        {item.name}
      </span>
    </div>
  );
}

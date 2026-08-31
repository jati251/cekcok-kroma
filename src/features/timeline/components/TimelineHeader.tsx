import { ZOOM_LIMITS } from "../../../constants/editor";

interface TimelineHeaderProps {
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  inPoint: number | null;
  outPoint: number | null;
}

export function TimelineHeader({
  zoomLevel,
  onZoomChange,
  inPoint,
  outPoint,
}: TimelineHeaderProps) {
  return (
    <div className="h-6 px-3 flex items-center justify-between bg-[var(--panel-bg)] border-b border-[var(--panel-border)] select-none shrink-0">
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
          type="range"
          min={ZOOM_LIMITS.MIN}
          max={ZOOM_LIMITS.MAX}
          value={zoomLevel}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="w-20 accent-accent cursor-pointer"
          title="Zoom (+ / -)"
        />
      </div>
    </div>
  );
}

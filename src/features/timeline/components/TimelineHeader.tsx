import { ZOOM_LIMITS } from "../../../constants/editor";
import { useEditorStore } from "../../../stores/useEditorStore";

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
  const linkedSelection = useEditorStore((state) => state.linkedSelection);
  const toggleLinkedSelection = useEditorStore((state) => state.toggleLinkedSelection);

  return (
    <div className="h-6 px-3 flex items-center justify-between bg-[var(--panel-bg)] border-b border-[var(--panel-border)] select-none shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold text-[#ddd]">Timeline: Sequence 01</span>

        {/* Linked Selection Toggle Button (Premiere Pro Link Icon) */}
        <button
          onClick={toggleLinkedSelection}
          className={`px-1.5 py-0.5 rounded flex items-center gap-1 text-[10px] cursor-pointer transition-colors ${
            linkedSelection ? "bg-accent text-white font-medium" : "bg-[#2c2c2c] text-[#777] hover:text-white"
          }`}
          title={linkedSelection ? "Linked Selection: ON (Audio & Video move together)" : "Linked Selection: OFF (Audio & Video separate)"}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span className="text-[9px]">{linkedSelection ? "Linked" : "Unlinked"}</span>
        </button>

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

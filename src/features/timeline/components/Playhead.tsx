import { useState } from "react";
import { useEditorStore } from "../../../stores/useEditorStore";

interface PlayheadProps {
  zoomLevel: number;
  timelineRef: React.RefObject<HTMLDivElement | null>;
}

export function Playhead({ zoomLevel, timelineRef }: PlayheadProps) {
  const playheadPosition = useEditorStore((state) => state.playheadPosition);
  const setPlayheadPosition = useEditorStore((state) => state.setPlayheadPosition);
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
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setIsDragging(false);
    }
  };

  const leftPos = playheadPosition * zoomLevel + 64;

  return (
    <div
      className="absolute top-0 bottom-0 pointer-events-none z-50 flex flex-col items-center select-none"
      style={{ left: leftPos, transform: "translateX(-50%)" }}
    >
      {/* Interactive Playhead Cap on Ruler */}
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

      {/* Playhead Needle (Vertical Line across all tracks) */}
      <div className="w-[1px] flex-1 bg-accent shadow-[0_0_4px_rgba(45,140,235,0.8)]" />
    </div>
  );
}

interface VideoCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  activeVideoSrc: string | null;
  showSafeMargins: boolean;
  snapshotFlash: boolean;
  onEnded: () => void;
}

export function VideoCanvas({
  videoRef,
  activeVideoSrc,
  showSafeMargins,
  snapshotFlash,
  onEnded,
}: VideoCanvasProps) {
  return (
    <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-[#0d0d0d] rounded-[2px] border border-[#222]">
      {activeVideoSrc ? (
        <div className="relative w-full h-full flex items-center justify-center">
          <video
            ref={videoRef}
            src={activeVideoSrc}
            className="w-full h-full object-contain"
            preload="auto"
            playsInline
            onEnded={onEnded}
          />

          {/* Safe Margins Overlay */}
          {showSafeMargins && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Action Safe (90%) */}
              <div className="w-[90%] h-[90%] border border-cyan-400/40 absolute flex items-center justify-center">
                {/* Title Safe (80%) */}
                <div className="w-[88.8%] h-[88.8%] border border-cyan-400/30 absolute" />
                {/* Center Crosshairs */}
                <div className="w-4 h-[1px] bg-cyan-400/60 absolute" />
                <div className="h-4 w-[1px] bg-cyan-400/60 absolute" />
              </div>
            </div>
          )}

          {/* Camera Snapshot Flash Effect */}
          {snapshotFlash && (
            <div className="absolute inset-0 bg-white opacity-80 pointer-events-none transition-opacity duration-200" />
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5 text-[#555] select-none">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="m9 8 6 4-6 4Z" />
          </svg>
          <span className="font-mono text-[11px] tracking-wider text-[#666]">Media Offline</span>
          <span className="text-[9px] text-[#444]">Import video in Project Media</span>
        </div>
      )}
    </div>
  );
}

import { ZoomMode, PlaybackResolution } from "../types";

interface VideoCanvasProps {
  videoRefA: React.RefObject<HTMLVideoElement | null>;
  videoRefB: React.RefObject<HTMLVideoElement | null>;
  srcA: string | null;
  srcB: string | null;
  activeSlot: "A" | "B";
  hasMedia: boolean;
  showSafeMargins: boolean;
  snapshotFlash: boolean;
  zoomMode: ZoomMode;
  resolution: PlaybackResolution;
  volume: number;
  isMuted: boolean;
  onEnded: () => void;
}

export function VideoCanvas({
  videoRefA,
  videoRefB,
  srcA,
  srcB,
  activeSlot,
  hasMedia,
  showSafeMargins,
  snapshotFlash,
  zoomMode,
  resolution,
  volume,
  isMuted,
  onEnded,
}: VideoCanvasProps) {
  // Compute transform style based on zoomMode
  const getZoomStyle = () => {
    switch (zoomMode) {
      case "100%":
        return { transform: "scale(1.0)", transformOrigin: "center center" };
      case "50%":
        return { transform: "scale(0.5)", transformOrigin: "center center" };
      case "25%":
        return { transform: "scale(0.25)", transformOrigin: "center center" };
      case "fit":
      default:
        return {};
    }
  };

  // Compute CSS filter for playback resolution simulation
  const getResolutionFilter = () => {
    switch (resolution) {
      case "1/2":
        return "blur(0.5px)";
      case "1/4":
        return "blur(1.5px)";
      case "Full":
      default:
        return "none";
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-[#0d0d0d] rounded-[2px] border border-[#222]">
      {hasMedia ? (
        <div
          className="relative w-full h-full flex items-center justify-center transition-transform duration-150"
          style={getZoomStyle()}
        >
          {/* Dual Ping-Pong Buffer Video A */}
          <video
            ref={videoRefA}
            src={srcA || undefined}
            className={`absolute inset-0 w-full h-full object-contain ${
              activeSlot === "A"
                ? "opacity-100 z-10"
                : "opacity-0 pointer-events-none z-0"
            }`}
            style={{
              filter: getResolutionFilter(),
              transform: "translateZ(0)",
              willChange: "transform",
            }}
            preload="auto"
            playsInline
            muted={isMuted || activeSlot !== "A"}
            onEnded={onEnded}
            onVolumeChange={(e) => {
              const v = (e.target as HTMLVideoElement).volume;
              if (v !== volume && !isMuted) {
                (e.target as HTMLVideoElement).volume = volume;
              }
            }}
          />

          {/* Dual Ping-Pong Buffer Video B */}
          <video
            ref={videoRefB}
            src={srcB || undefined}
            className={`absolute inset-0 w-full h-full object-contain ${
              activeSlot === "B"
                ? "opacity-100 z-10"
                : "opacity-0 pointer-events-none z-0"
            }`}
            style={{
              filter: getResolutionFilter(),
              transform: "translateZ(0)",
              willChange: "transform",
            }}
            preload="auto"
            playsInline
            muted={isMuted || activeSlot !== "B"}
            onEnded={onEnded}
            onVolumeChange={(e) => {
              const v = (e.target as HTMLVideoElement).volume;
              if (v !== volume && !isMuted) {
                (e.target as HTMLVideoElement).volume = volume;
              }
            }}
          />

          {/* Safe Margins Overlay (Action Safe 90% & Title Safe 80%) */}
          {showSafeMargins && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
              <div className="w-[90%] h-[90%] border border-cyan-400/40 absolute flex items-center justify-center">
                <div className="w-[88.8%] h-[88.8%] border border-cyan-400/30 absolute" />
                <div className="w-4 h-[1px] bg-cyan-400/60 absolute" />
                <div className="h-4 w-[1px] bg-cyan-400/60 absolute" />
              </div>
            </div>
          )}

          {/* Camera Snapshot Flash */}
          {snapshotFlash && (
            <div className="absolute inset-0 bg-white opacity-80 pointer-events-none transition-opacity duration-200 z-30" />
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5 text-[#555] select-none">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="m9 8 6 4-6 4Z" />
          </svg>
          <span className="font-mono text-[11px] tracking-wider text-[#666]">Media Offline</span>
          <span className="text-[9px] text-[#444]">Drag imported video to timeline</span>
        </div>
      )}
    </div>
  );
}

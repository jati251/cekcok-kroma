import { useState } from "react";
import { formatTimecode } from "../../../utils/timecode";
import { ZoomMode, PlaybackResolution } from "../types";
import { useVideoPlayback } from "../hooks/useVideoPlayback";
import { MonitorHeader } from "./MonitorHeader";
import { VideoCanvas } from "./VideoCanvas";
import { AudioVuMeter } from "./AudioVuMeter";
import { TransportBar } from "./TransportBar";

export function ProgramMonitor() {
  const {
    videoRef,
    activeVideoSrc,
    totalDuration,
    meterL,
    meterR,
    playheadPosition,
    isPlaying,
    setIsPlaying,
  } = useVideoPlayback();

  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit");
  const [resolution, setResolution] = useState<PlaybackResolution>("Full");
  const [showSafeMargins, setShowSafeMargins] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [snapshotFlash, setSnapshotFlash] = useState(false);

  const handleExportFrame = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 1920;
      canvas.height = videoRef.current.videoHeight || 1080;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `frame_${formatTimecode(playheadPosition).replace(/:/g, "-")}.png`;
        a.click();
      }
      setSnapshotFlash(true);
      setTimeout(() => setSnapshotFlash(false), 200);
    } catch (e) {
      console.error("Frame capture failed:", e);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--panel-bg)] border border-[var(--panel-border)] h-full overflow-hidden select-none">
      <MonitorHeader
        zoomMode={zoomMode}
        onZoomModeChange={setZoomMode}
        resolution={resolution}
        onResolutionChange={setResolution}
        playheadPosition={playheadPosition}
        totalDuration={totalDuration}
      />

      <div className="flex-1 p-2 flex gap-2 relative bg-[#111] overflow-hidden">
        <VideoCanvas
          videoRef={videoRef}
          activeVideoSrc={activeVideoSrc}
          showSafeMargins={showSafeMargins}
          snapshotFlash={snapshotFlash}
          onEnded={() => setIsPlaying(false)}
        />
        <AudioVuMeter meterL={meterL} meterR={meterR} />
      </div>

      <TransportBar
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        showSafeMargins={showSafeMargins}
        onToggleSafeMargins={() => setShowSafeMargins(!showSafeMargins)}
        isLooping={isLooping}
        onToggleLoop={() => setIsLooping(!isLooping)}
        onExportFrame={handleExportFrame}
      />
    </div>
  );
}

import { useState } from "react";
import { formatTimecode } from "../../../utils/timecode";
import { useEditorStore } from "../../../stores/useEditorStore";
import { ZoomMode, PlaybackResolution } from "../types";
import { useVideoPlayback } from "../hooks/useVideoPlayback";
import { MonitorHeader } from "./MonitorHeader";
import { VideoCanvas } from "./VideoCanvas";
import { AudioVuMeter } from "./AudioVuMeter";
import { TransportBar } from "./TransportBar";

export function ProgramMonitor() {
  const {
    canvasRef,
    hasMedia,
    totalDuration,
    meterL,
    meterR,
    playheadPosition,
    isPlaying,
    setIsPlaying,
    resumeAudio,
  } = useVideoPlayback();

  const masterVolume = useEditorStore((state) => state.masterVolume);
  const setMasterVolume = useEditorStore((state) => state.setMasterVolume);
  const isMasterMuted = useEditorStore((state) => state.isMasterMuted);
  const toggleMasterMute = useEditorStore((state) => state.toggleMasterMute);

  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit");
  const [resolution, setResolution] = useState<PlaybackResolution>("Full");
  const [showSafeMargins, setShowSafeMargins] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [snapshotFlash, setSnapshotFlash] = useState(false);

  const handleTogglePlay = () => {
    resumeAudio(); // Ensure Web Audio API is un-suspended on explicit user interaction
    setIsPlaying(!isPlaying);
  };

  const handleExportFrame = () => {
    if (!canvasRef.current) return;
    try {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `frame_${formatTimecode(playheadPosition).replace(/:/g, "-")}.png`;
      a.click();
      
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
          canvasRef={canvasRef}
          hasMedia={hasMedia}
          showSafeMargins={showSafeMargins}
          snapshotFlash={snapshotFlash}
          zoomMode={zoomMode}
          resolution={resolution}
        />
        <AudioVuMeter meterL={meterL} meterR={meterR} />
      </div>

      <TransportBar
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        showSafeMargins={showSafeMargins}
        onToggleSafeMargins={() => setShowSafeMargins(!showSafeMargins)}
        isLooping={isLooping}
        onToggleLoop={() => setIsLooping(!isLooping)}
        onExportFrame={handleExportFrame}
        volume={masterVolume}
        onVolumeChange={setMasterVolume}
        isMuted={isMasterMuted}
        onToggleMute={toggleMasterMute}
      />
    </div>
  );
}

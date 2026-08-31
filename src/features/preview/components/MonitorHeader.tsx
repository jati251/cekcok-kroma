import { formatTimecode } from "../../../utils/timecode";
import { ZoomMode, PlaybackResolution } from "../types";

interface MonitorHeaderProps {
  zoomMode: ZoomMode;
  onZoomModeChange: (mode: ZoomMode) => void;
  resolution: PlaybackResolution;
  onResolutionChange: (res: PlaybackResolution) => void;
  playheadPosition: number;
  totalDuration: number;
}

export function MonitorHeader({
  zoomMode,
  onZoomModeChange,
  resolution,
  onResolutionChange,
  playheadPosition,
  totalDuration,
}: MonitorHeaderProps) {
  return (
    <div className="h-6 px-3 flex items-center justify-between bg-[#282828] border-b border-[#181818] shrink-0 select-none">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold text-[#ddd]">Program: Sequence 01</span>

        <select
          value={zoomMode}
          onChange={(e) => onZoomModeChange(e.target.value as ZoomMode)}
          className="bg-[#1f1f1f] text-[10px] text-[#aaa] border border-[#333] rounded px-1.5 py-0.5 cursor-pointer outline-none hover:border-[#555]"
        >
          <option value="fit">Fit</option>
          <option value="100%">100%</option>
          <option value="50%">50%</option>
          <option value="25%">25%</option>
        </select>

        <select
          value={resolution}
          onChange={(e) => onResolutionChange(e.target.value as PlaybackResolution)}
          className="bg-[#1f1f1f] text-[10px] text-[#aaa] border border-[#333] rounded px-1.5 py-0.5 cursor-pointer outline-none hover:border-[#555]"
        >
          <option value="Full">Full</option>
          <option value="1/2">1/2</option>
          <option value="1/4">1/4</option>
        </select>
      </div>

      <div className="flex items-center gap-2 font-mono text-[10px]">
        <span className="text-accent font-bold">{formatTimecode(playheadPosition)}</span>
        <span className="text-[#555]">/</span>
        <span className="text-[#888]">{formatTimecode(totalDuration)}</span>
      </div>
    </div>
  );
}

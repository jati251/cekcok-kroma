import { useEditorStore } from "../../../stores/useEditorStore";

interface TransportBarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  showSafeMargins: boolean;
  onToggleSafeMargins: () => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  onExportFrame: () => void;
}

export function TransportBar({
  isPlaying,
  onTogglePlay,
  showSafeMargins,
  onToggleSafeMargins,
  isLooping,
  onToggleLoop,
  onExportFrame,
}: TransportBarProps) {
  const inPoint = useEditorStore((state) => state.inPoint);
  const setInPoint = useEditorStore((state) => state.setInPoint);
  const outPoint = useEditorStore((state) => state.outPoint);
  const setOutPoint = useEditorStore((state) => state.setOutPoint);
  const playheadPosition = useEditorStore((state) => state.playheadPosition);
  const setPlayheadPosition = useEditorStore((state) => state.setPlayheadPosition);
  const stepFrame = useEditorStore((state) => state.stepFrame);

  return (
    <div className="h-9 shrink-0 bg-[#242424] border-t border-[#181818] px-3 flex items-center justify-between select-none">
      {/* Left: Mark In/Out */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setInPoint(playheadPosition)}
          className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono cursor-pointer transition-colors ${
            inPoint !== null ? "bg-[#333] text-accent font-bold" : "text-[#aaa] hover:bg-[#333]"
          }`}
          title="Mark In ({)"
        >
          &#123;
        </button>
        <button
          onClick={() => setOutPoint(playheadPosition)}
          className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono cursor-pointer transition-colors ${
            outPoint !== null ? "bg-[#333] text-accent font-bold" : "text-[#aaa] hover:bg-[#333]"
          }`}
          title="Mark Out (})"
        >
          &#125;
        </button>
      </div>

      {/* Center: Playback Transport Buttons */}
      <div className="flex items-center gap-1">
        {/* Go to In Point */}
        <button
          className="w-7 h-6 flex items-center justify-center text-[#bbb] hover:bg-[#333] hover:text-white rounded cursor-pointer transition-colors"
          onClick={() => inPoint !== null && setPlayheadPosition(inPoint)}
          title="Go to In Point (Shift+I)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
          </svg>
        </button>

        {/* Step 1 Frame Back */}
        <button
          className="w-7 h-6 flex items-center justify-center text-[#bbb] hover:bg-[#333] hover:text-white rounded cursor-pointer transition-colors"
          onClick={() => stepFrame(-1)}
          title="Step Back 1 Frame (Arrow Left)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 18h-2V6h2zm-3.5-6L6 6v12z" transform="rotate(180 12 12)" />
          </svg>
        </button>

        {/* Master Play / Pause Button */}
        <button
          className={`w-8 h-7 flex items-center justify-center rounded cursor-pointer transition-all shadow-sm ${
            isPlaying ? "bg-accent text-white" : "bg-[#333] text-white hover:bg-[#3f3f3f]"
          }`}
          onClick={onTogglePlay}
          title="Play / Pause (Space)"
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Step 1 Frame Forward */}
        <button
          className="w-7 h-6 flex items-center justify-center text-[#bbb] hover:bg-[#333] hover:text-white rounded cursor-pointer transition-colors"
          onClick={() => stepFrame(1)}
          title="Step Forward 1 Frame (Arrow Right)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" transform="rotate(180 12 12)" />
          </svg>
        </button>

        {/* Go to Out Point */}
        <button
          className="w-7 h-6 flex items-center justify-center text-[#bbb] hover:bg-[#333] hover:text-white rounded cursor-pointer transition-colors"
          onClick={() => outPoint !== null && setPlayheadPosition(outPoint)}
          title="Go to Out Point (Shift+O)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 6h2v12h-2zm-1.5 6-8.5-6v12z" />
          </svg>
        </button>
      </div>

      {/* Right: Aux Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleSafeMargins}
          className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors ${
            showSafeMargins ? "bg-accent text-white" : "text-[#888] hover:bg-[#333] hover:text-white"
          }`}
          title="Safe Margins"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
          </svg>
        </button>

        <button
          onClick={onToggleLoop}
          className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors ${
            isLooping ? "bg-accent text-white" : "text-[#888] hover:bg-[#333] hover:text-white"
          }`}
          title="Loop Playback"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m17 2 4 4-4 4" />
            <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
            <path d="m7 22-4-4 4-4" />
            <path d="M21 13v1a4 4 0 0 1-4 4H3" />
          </svg>
        </button>

        <button
          onClick={onExportFrame}
          className="w-6 h-6 rounded flex items-center justify-center text-[#888] hover:bg-[#333] hover:text-white cursor-pointer transition-colors"
          title="Export Frame (Camera)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface TrackHeaderProps {
  name: string;
  isLocked?: boolean;
  isMuted?: boolean;
  onToggleLock: () => void;
  onToggleMute?: () => void;
}

export function TrackHeader({
  name,
  isLocked,
  isMuted,
  onToggleLock,
  onToggleMute,
}: TrackHeaderProps) {
  const isAudio = name.startsWith("A");

  return (
    <div className="w-16 h-full border-r border-[var(--panel-border)] bg-[var(--panel-bg)] flex items-center justify-between px-1.5 sticky left-0 z-30 shrink-0 select-none">
      <span className="text-[10px] text-[#888] font-semibold">{name}</span>

      <div className="flex items-center gap-1 text-[8px]">
        {/* Track Lock Padlock Button */}
        <button
          onClick={onToggleLock}
          className={`p-0.5 rounded cursor-pointer transition-colors ${
            isLocked ? "text-amber-400 font-bold" : "text-[#555] hover:text-white"
          }`}
          title={isLocked ? "Unlock Track" : "Lock Track"}
        >
          {isLocked ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
          )}
        </button>

        {/* Mute Button (Audio only) */}
        {isAudio && (
          <button
            onClick={onToggleMute}
            className={`px-1 py-0.5 rounded font-bold cursor-pointer transition-colors ${
              isMuted ? "bg-red-600 text-white" : "text-[#555] hover:text-white"
            }`}
            title={isMuted ? "Unmute Track" : "Mute Track"}
          >
            M
          </button>
        )}

        <button className="text-[#555] hover:text-white cursor-pointer" title="Solo">
          S
        </button>
      </div>
    </div>
  );
}

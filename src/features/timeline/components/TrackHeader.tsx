interface TrackHeaderProps {
  name: string;
}

export function TrackHeader({ name }: TrackHeaderProps) {
  return (
    <div className="w-16 h-full border-r border-[var(--panel-border)] bg-[var(--panel-bg)] flex items-center justify-between px-2 sticky left-0 z-30 shrink-0 select-none">
      <span className="text-[10px] text-[#888] font-semibold">{name}</span>
      <div className="flex gap-1 text-[8px] text-[#555]">
        <button className="hover:text-white cursor-pointer" title="Mute">
          M
        </button>
        <button className="hover:text-white cursor-pointer" title="Solo">
          S
        </button>
      </div>
    </div>
  );
}

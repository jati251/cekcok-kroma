interface AudioVuMeterProps {
  meterL: number;
  meterR: number;
}

function calculateMeterHeight(dB: number): number {
  if (dB <= -48) return 0;
  return Math.min(100, Math.max(0, ((dB + 48) / 48) * 100));
}

export function AudioVuMeter({ meterL, meterR }: AudioVuMeterProps) {
  return (
    <div className="w-7 bg-[#1c1c1c] border border-[#2c2c2c] rounded-[2px] flex flex-col p-1 shrink-0 select-none">
      <div className="text-[7px] text-[#666] font-mono text-center mb-1">dB</div>
      <div className="flex-1 flex justify-between gap-1 relative overflow-hidden">
        {/* Left Channel */}
        <div className="flex-1 bg-[#111] rounded-sm relative overflow-hidden flex flex-col justify-end">
          <div
            className="w-full bg-gradient-to-t from-green-500 via-yellow-400 to-red-500 transition-all duration-75"
            style={{ height: `${calculateMeterHeight(meterL)}%` }}
          />
        </div>

        {/* Right Channel */}
        <div className="flex-1 bg-[#111] rounded-sm relative overflow-hidden flex flex-col justify-end">
          <div
            className="w-full bg-gradient-to-t from-green-500 via-yellow-400 to-red-500 transition-all duration-75"
            style={{ height: `${calculateMeterHeight(meterR)}%` }}
          />
        </div>

        {/* Scale Overlay */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[6px] text-[#444] font-mono leading-none pl-0.5">
          <span>0</span>
          <span>-6</span>
          <span>-12</span>
          <span>-24</span>
          <span>-48</span>
        </div>
      </div>
      <div className="flex justify-between text-[7px] text-[#666] font-mono mt-1 px-0.5">
        <span>L</span>
        <span>R</span>
      </div>
    </div>
  );
}

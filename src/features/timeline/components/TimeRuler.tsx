import { useEffect, useRef } from "react";
import { formatTimecode } from "../../../utils/timecode";

interface TimeRulerProps {
  zoomLevel: number;
  width: number;
}

export function TimeRuler({ zoomLevel, width }: TimeRulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "#18181b"; // background
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#52525b";
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "10px monospace";
    ctx.textBaseline = "top";

    const totalSeconds = width / zoomLevel;

    // Draw ticks
    for (let s = 0; s <= totalSeconds; s++) {
      const x = s * zoomLevel;

      // Draw second tick
      ctx.beginPath();
      ctx.moveTo(x, height - 10);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Draw text for every 5 seconds or depending on zoom
      if (s % Math.max(1, Math.floor(100 / zoomLevel)) === 0) {
        ctx.fillText(formatTimecode(s), x + 2, 2);
      }

      // Draw half-second ticks
      if (zoomLevel > 50) {
        ctx.beginPath();
        ctx.moveTo(x + zoomLevel / 2, height - 5);
        ctx.lineTo(x + zoomLevel / 2, height);
        ctx.stroke();
      }
    }
  }, [zoomLevel, width]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={24}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
    />
  );
}

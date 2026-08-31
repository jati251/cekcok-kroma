import { useEffect, useRef, useState, useMemo } from "react";
import { useEditorStore, formatTimecode } from "../../stores/useEditorStore";
import { convertFileSrc } from "@tauri-apps/api/core";

export function ProgramMonitor() {
  const playheadPosition = useEditorStore(state => state.playheadPosition);
  const setPlayheadPosition = useEditorStore(state => state.setPlayheadPosition);
  const mediaItems = useEditorStore(state => state.mediaItems);
  const tracks = useEditorStore(state => state.tracks);
  const isPlaying = useEditorStore(state => state.isPlaying);
  const setIsPlaying = useEditorStore(state => state.setIsPlaying);
  const inPoint = useEditorStore(state => state.inPoint);
  const setInPoint = useEditorStore(state => state.setInPoint);
  const outPoint = useEditorStore(state => state.outPoint);
  const setOutPoint = useEditorStore(state => state.setOutPoint);
  const stepFrame = useEditorStore(state => state.stepFrame);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeVideoSrc, setActiveVideoSrc] = useState<string | null>(null);

  // Monitor UI features
  const [zoomMode, setZoomMode] = useState<"fit" | "100%" | "50%" | "25%">("fit");
  const [resolution, setResolution] = useState<"Full" | "1/2" | "1/4">("Full");
  const [showSafeMargins, setShowSafeMargins] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [snapshotFlash, setSnapshotFlash] = useState(false);

  // Simulated audio meter levels
  const [meterL, setMeterL] = useState(-60);
  const [meterR, setMeterR] = useState(-60);

  // Calculate total sequence duration
  const totalDuration = useMemo(() => {
    let max = 0;
    tracks.forEach(t => {
      t.items.forEach(item => {
        const end = (item.start || 0) + (item.duration || 0);
        if (end > max) max = end;
      });
    });
    return Math.max(max, 10);
  }, [tracks]);

  // Determine active video from tracks or fallback to latest mediaItem
  useEffect(() => {
    // Check if any clip on video tracks covers current playhead
    let foundSrc: string | null = null;
    for (const track of tracks) {
      if (track.id.startsWith("v")) {
        const clip = track.items.find(
          item => playheadPosition >= (item.start || 0) && playheadPosition <= (item.start || 0) + (item.duration || 0)
        );
        if (clip && clip.src) {
          foundSrc = clip.src;
          break;
        }
      }
    }

    // Fallback to latest media in bin if no clip on track
    if (!foundSrc && mediaItems.length > 0) {
      const last = mediaItems[mediaItems.length - 1];
      if (last.src) foundSrc = last.src;
    }

    if (foundSrc) {
      try {
        const converted = convertFileSrc(foundSrc);
        setActiveVideoSrc(prev => (prev === converted ? prev : converted));
      } catch (err) {
        console.error("Failed to convert video src:", err);
      }
    }
  }, [tracks, mediaItems, playheadPosition]);

  // Handle Play/Pause commands
  useEffect(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.play().catch(e => {
        console.warn("Playback interrupted:", e);
        setIsPlaying(false);
      });
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying, setIsPlaying]);

  // Sync playhead scrubbing to video currentTime
  useEffect(() => {
    if (!videoRef.current) return;
    if (!isPlaying && Math.abs(videoRef.current.currentTime - playheadPosition) > 0.04) {
      videoRef.current.currentTime = playheadPosition;
    }
  }, [playheadPosition, isPlaying]);

  // Sync video time TO playhead during active playback + animate Audio VU meter
  useEffect(() => {
    let animationFrameId: number;
    
    const updateLoop = () => {
      if (isPlaying && videoRef.current) {
        setPlayheadPosition(videoRef.current.currentTime);

        // Simulate lively audio meters while playing
        const base = -14 + (Math.sin(Date.now() / 80) * 10);
        setMeterL(Math.max(-48, Math.min(-2, base + (Math.random() * 4))));
        setMeterR(Math.max(-48, Math.min(-2, base + (Math.random() * 5))));

        // Loop handling
        if (isLooping && outPoint && videoRef.current.currentTime >= outPoint) {
          videoRef.current.currentTime = inPoint || 0;
          setPlayheadPosition(inPoint || 0);
        }
      } else {
        setMeterL(-60);
        setMeterR(-60);
      }
      animationFrameId = requestAnimationFrame(updateLoop);
    };

    animationFrameId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, isLooping, inPoint, outPoint, setPlayheadPosition]);

  // Snapshot frame (Camera button)
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

  const calculateMeterHeight = (dB: number) => {
    // dB range: -48dB (0%) to 0dB (100%)
    if (dB <= -48) return 0;
    return Math.min(100, Math.max(0, ((dB + 48) / 48) * 100));
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--panel-bg)] border border-[var(--panel-border)] h-full overflow-hidden select-none">
      {/* Top Monitor Header Bar */}
      <div className="h-6 px-3 flex items-center justify-between bg-[#282828] border-b border-[#181818] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-[#ddd]">Program: Sequence 01</span>
          
          {/* Zoom Mode Dropdown */}
          <select 
            value={zoomMode} 
            onChange={(e) => setZoomMode(e.target.value as any)}
            className="bg-[#1f1f1f] text-[10px] text-[#aaa] border border-[#333] rounded px-1.5 py-0.5 cursor-pointer outline-none hover:border-[#555]"
          >
            <option value="fit">Fit</option>
            <option value="100%">100%</option>
            <option value="50%">50%</option>
            <option value="25%">25%</option>
          </select>

          {/* Resolution Dropdown */}
          <select 
            value={resolution} 
            onChange={(e) => setResolution(e.target.value as any)}
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

      {/* Main Viewport + Stereo Audio VU Meter */}
      <div className="flex-1 p-2 flex gap-2 relative bg-[#111] overflow-hidden">
        {/* Video Canvas Container */}
        <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-[#0d0d0d] rounded-[2px] border border-[#222]">
          {activeVideoSrc ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <video 
                ref={videoRef}
                src={activeVideoSrc}
                className="w-full h-full object-contain"
                preload="auto"
                playsInline
                onEnded={() => setIsPlaying(false)}
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

              {/* Camera Snapshot Flash */}
              {snapshotFlash && (
                <div className="absolute inset-0 bg-white opacity-80 pointer-events-none transition-opacity duration-200" />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-[#555]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect width="18" height="18" x="3" y="3" rx="2" /><path d="m9 8 6 4-6 4Z" />
              </svg>
              <span className="font-mono text-[11px] tracking-wider text-[#666]">Media Offline</span>
              <span className="text-[9px] text-[#444]">Import video in Project Media</span>
            </div>
          )}
        </div>

        {/* Master Stereo Audio VU Meter (Premiere Pro Style) */}
        <div className="w-7 bg-[#1c1c1c] border border-[#2c2c2c] rounded-[2px] flex flex-col p-1 shrink-0 select-none">
          <div className="text-[7px] text-[#666] font-mono text-center mb-1">dB</div>
          <div className="flex-1 flex justify-between gap-1 relative overflow-hidden">
            {/* Left Channel Bar */}
            <div className="flex-1 bg-[#111] rounded-sm relative overflow-hidden flex flex-col justify-end">
              <div 
                className="w-full bg-gradient-to-t from-green-500 via-yellow-400 to-red-500 transition-all duration-75"
                style={{ height: `${calculateMeterHeight(meterL)}%` }}
              />
            </div>

            {/* Right Channel Bar */}
            <div className="flex-1 bg-[#111] rounded-sm relative overflow-hidden flex flex-col justify-end">
              <div 
                className="w-full bg-gradient-to-t from-green-500 via-yellow-400 to-red-500 transition-all duration-75"
                style={{ height: `${calculateMeterHeight(meterR)}%` }}
              />
            </div>

            {/* Scale Ticks Overlay */}
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
      </div>

      {/* Premiere Pro Transport & Control Bar */}
      <div className="h-9 shrink-0 bg-[#242424] border-t border-[#181818] px-3 flex items-center justify-between">
        {/* Left: Timecode and Mark In/Out */}
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
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
            </svg>
          </button>

          {/* Step 1 Frame Back */}
          <button 
            className="w-7 h-6 flex items-center justify-center text-[#bbb] hover:bg-[#333] hover:text-white rounded cursor-pointer transition-colors"
            onClick={() => stepFrame(-1)}
            title="Step Back 1 Frame (Arrow Left)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 18h-2V6h2zm-3.5-6L6 6v12z" transform="rotate(180 12 12)"/>
            </svg>
          </button>

          {/* Master Play / Pause Button */}
          <button 
            className={`w-8 h-7 flex items-center justify-center rounded cursor-pointer transition-all shadow-sm ${
              isPlaying ? "bg-accent text-white" : "bg-[#333] text-white hover:bg-[#3f3f3f]"
            }`}
            onClick={() => setIsPlaying(!isPlaying)}
            title="Play / Pause (Space)"
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
                <path d="M8 5v14l11-7z"/>
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
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" transform="rotate(180 12 12)"/>
            </svg>
          </button>

          {/* Go to Out Point */}
          <button 
            className="w-7 h-6 flex items-center justify-center text-[#bbb] hover:bg-[#333] hover:text-white rounded cursor-pointer transition-colors"
            onClick={() => outPoint !== null && setPlayheadPosition(outPoint)}
            title="Go to Out Point (Shift+O)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 6h2v12h-2zm-1.5 6-8.5-6v12z"/>
            </svg>
          </button>
        </div>

        {/* Right: Auxiliary Controls (Safe Margins, Loop, Snapshot, Settings) */}
        <div className="flex items-center gap-1">
          {/* Safe Margins Toggle */}
          <button 
            onClick={() => setShowSafeMargins(!showSafeMargins)}
            className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors ${
              showSafeMargins ? "bg-accent text-white" : "text-[#888] hover:bg-[#333] hover:text-white"
            }`}
            title="Safe Margins"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
            </svg>
          </button>

          {/* Loop Toggle */}
          <button 
            onClick={() => setIsLooping(!isLooping)}
            className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors ${
              isLooping ? "bg-accent text-white" : "text-[#888] hover:bg-[#333] hover:text-white"
            }`}
            title="Loop Playback"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>
            </svg>
          </button>

          {/* Snapshot / Export Frame */}
          <button 
            onClick={handleExportFrame}
            className="w-6 h-6 rounded flex items-center justify-center text-[#888] hover:bg-[#333] hover:text-white cursor-pointer transition-colors"
            title="Export Frame (Camera)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
              <circle cx="12" cy="13" r="3"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

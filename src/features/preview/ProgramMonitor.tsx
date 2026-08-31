import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../../stores/useEditorStore";
import { convertFileSrc } from "@tauri-apps/api/core";

export function ProgramMonitor() {
  const playheadPosition = useEditorStore(state => state.playheadPosition);
  const setPlayheadPosition = useEditorStore(state => state.setPlayheadPosition);
  const mediaItems = useEditorStore(state => state.mediaItems);
  const isPlaying = useEditorStore(state => state.isPlaying);
  const setIsPlaying = useEditorStore(state => state.setIsPlaying);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeVideoSrc, setActiveVideoSrc] = useState<string | null>(null);
  
  // To prevent circular updates when syncing playhead <-> video.currentTime
  const isScrubbing = useRef(false);

  useEffect(() => {
    if (mediaItems.length > 0) {
      // Find the media that is actively at the playhead in the tracks!
      // For MVP, we still just play the last imported video, but using native URL.
      const media = mediaItems[mediaItems.length - 1];
      if (media.src) {
        setActiveVideoSrc(convertFileSrc(media.src));
      }
    }
  }, [mediaItems]);

  // Handle Play/Pause commands from Store
  useEffect(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.play().catch(e => {
        console.error("Playback failed:", e);
        setIsPlaying(false);
      });
      isScrubbing.current = false;
    } else {
      videoRef.current.pause();
      isScrubbing.current = true;
    }
  }, [isPlaying, setIsPlaying]);

  // Sync playhead state when dragging timeline (scrubbing)
  useEffect(() => {
    if (!videoRef.current) return;
    
    // Only update video time if we are not playing (meaning user is scrubbing the timeline)
    if (!isPlaying && Math.abs(videoRef.current.currentTime - playheadPosition) > 0.05) {
      videoRef.current.currentTime = playheadPosition;
    }
  }, [playheadPosition, isPlaying]);

  // Sync state FROM video to playhead during playback (Hardware accelerated 60fps)
  useEffect(() => {
    let animationFrameId: number;
    
    const updatePlayhead = () => {
      if (isPlaying && videoRef.current) {
        setPlayheadPosition(videoRef.current.currentTime);
      }
      animationFrameId = requestAnimationFrame(updatePlayhead);
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(updatePlayhead);
    }
    
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, setPlayheadPosition]);

  return (
    <div className="flex-1 flex flex-col bg-[var(--panel-bg)] border border-[var(--panel-border)] h-full">
      <div className="h-6 px-3 flex items-center bg-[#2d2d2d] border-b border-[#111]">
        <span className="text-[11px] text-[#ccc] flex-1">Program Monitor</span>
        <span className="font-mono text-accent">{formatTimecode(playheadPosition)}</span>
      </div>
      
      <div className="flex-1 p-2 flex flex-col relative bg-[#111]">
        <div className="flex-1 flex items-center justify-center overflow-hidden bg-black">
          {activeVideoSrc ? (
            <video 
              ref={videoRef}
              src={activeVideoSrc}
              className="w-full h-full object-contain"
              preload="auto"
              playsInline
              onEnded={() => setIsPlaying(false)}
              onLoadedMetadata={() => {
                // Ensure video is ready before applying current time
                if (!isPlaying && videoRef.current) {
                  videoRef.current.currentTime = playheadPosition;
                }
              }}
            />
          ) : (
            <span className="text-[#555] font-mono">Media Offline</span>
          )}
        </div>
        
        {/* Playback Controls (Premiere Style) */}
        <div className="h-8 shrink-0 flex items-center justify-center gap-2 mt-2">
          <button 
            className="w-8 h-6 flex items-center justify-center hover:bg-[#333] rounded"
            onClick={() => setPlayheadPosition(0)}
            title="Go to Start"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
          </button>
          
          <button 
            className="w-8 h-6 flex items-center justify-center hover:bg-[#333] rounded"
            onClick={() => setIsPlaying(!isPlaying)}
            title="Play / Pause (Space)"
          >
            {isPlaying ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Utility to duplicate from store so we don't need to export it if we didn't
const formatTimecode = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 30);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
};

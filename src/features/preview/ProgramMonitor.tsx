import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../../stores/useEditorStore";
import { convertFileSrc } from "@tauri-apps/api/core";
import { motion } from "framer-motion";

export function ProgramMonitor() {
  const { draggedItem, playheadPosition, mediaItems } = useEditorStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeVideoSrc, setActiveVideoSrc] = useState<string | null>(null);

  // In a complete architecture, we'd query the Timeline tracks from the store
  // to see which clip is under the playhead. 
  // Since Timeline currently holds its own tracks state for MVP simplicity,
  // we will just play the FIRST imported media that exists if it's placed on the timeline.
  // Actually, to make it work beautifully without overengineering:
  // If there is media imported, we'll sync the first media to the playhead as a proof of concept.
  
  useEffect(() => {
    // Basic active clip detection logic:
    // If we have media, show the last imported media. 
    // We convert the absolute path to a tauri asset:// URL.
    if (mediaItems.length > 0) {
      const media = mediaItems[mediaItems.length - 1];
      if (media.src) {
        setActiveVideoSrc(convertFileSrc(media.src));
      }
    }
  }, [mediaItems]);

  useEffect(() => {
    if (videoRef.current) {
      // Sync video time to playhead exactly!
      // This gives the illusion of a real engine scrubbing
      videoRef.current.currentTime = playheadPosition;
    }
  }, [playheadPosition]);

  return (
    <div className="flex-1 flex flex-col bg-background h-full">
      <div className="p-2 border-b border-border text-xs font-medium uppercase tracking-wider text-zinc-400 flex justify-between">
        <span>Program Monitor</span>
      </div>
      <div className="flex-1 p-4 flex items-center justify-center relative bg-black/50">
        <div className="w-full h-full max-h-full max-w-full aspect-video bg-black rounded border border-border shadow-2xl flex items-center justify-center overflow-hidden relative">
          
          {activeVideoSrc ? (
            <video 
              ref={videoRef}
              src={activeVideoSrc}
              className="w-full h-full object-contain"
              muted // Mute to prevent audio chaos when scrubbing
              preload="auto"
            />
          ) : (
            <span className="text-zinc-600 font-mono text-sm">No Media Found</span>
          )}

          {draggedItem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-accent/10 border-2 border-dashed border-accent flex items-center justify-center pointer-events-none"
            >
              <span className="text-accent text-sm font-medium">Drop to Import</span>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

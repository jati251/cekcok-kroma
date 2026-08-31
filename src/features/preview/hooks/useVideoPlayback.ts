import { useEffect, useRef, useState, useMemo } from "react";
import { useEditorStore } from "../../../stores/useEditorStore";
import { convertFileSrc } from "@tauri-apps/api/core";

export function useVideoPlayback() {
  const playheadPosition = useEditorStore((state) => state.playheadPosition);
  const setPlayheadPosition = useEditorStore((state) => state.setPlayheadPosition);
  const mediaItems = useEditorStore((state) => state.mediaItems);
  const tracks = useEditorStore((state) => state.tracks);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const inPoint = useEditorStore((state) => state.inPoint);
  const outPoint = useEditorStore((state) => state.outPoint);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeVideoSrc, setActiveVideoSrc] = useState<string | null>(null);
  const [meterL, setMeterL] = useState(-60);
  const [meterR, setMeterR] = useState(-60);

  // Compute total duration of the sequence
  const totalDuration = useMemo(() => {
    let max = 0;
    tracks.forEach((t) => {
      t.items.forEach((item) => {
        const end = (item.start || 0) + (item.duration || 0);
        if (end > max) max = end;
      });
    });
    return Math.max(max, 10);
  }, [tracks]);

  // Resolve active video source derived from current playhead position
  useEffect(() => {
    let foundSrc: string | null = null;
    for (const track of tracks) {
      if (track.id.startsWith("v")) {
        const clip = track.items.find(
          (item) =>
            playheadPosition >= (item.start || 0) &&
            playheadPosition <= (item.start || 0) + (item.duration || 0)
        );
        if (clip && clip.src) {
          foundSrc = clip.src;
          break;
        }
      }
    }

    if (!foundSrc && mediaItems.length > 0) {
      const last = mediaItems[mediaItems.length - 1];
      if (last.src) foundSrc = last.src;
    }

    if (foundSrc) {
      try {
        const converted = convertFileSrc(foundSrc);
        setActiveVideoSrc((prev) => (prev === converted ? prev : converted));
      } catch (err) {
        console.error("Failed to convert video src:", err);
      }
    }
  }, [tracks, mediaItems, playheadPosition]);

  // Handle Play/Pause commands
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.play().catch((e) => {
        console.warn("Playback interrupted:", e);
        setIsPlaying(false);
      });
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying, setIsPlaying]);

  // Sync scrubbing to video element
  useEffect(() => {
    if (!videoRef.current) return;
    if (!isPlaying && Math.abs(videoRef.current.currentTime - playheadPosition) > 0.04) {
      videoRef.current.currentTime = playheadPosition;
    }
  }, [playheadPosition, isPlaying]);

  // Playhead and VU meter update loop
  useEffect(() => {
    let animationFrameId: number;

    const updateLoop = () => {
      if (isPlaying && videoRef.current) {
        setPlayheadPosition(videoRef.current.currentTime);

        const base = -14 + Math.sin(Date.now() / 80) * 10;
        setMeterL(Math.max(-48, Math.min(-2, base + Math.random() * 4)));
        setMeterR(Math.max(-48, Math.min(-2, base + Math.random() * 5)));
      } else {
        setMeterL(-60);
        setMeterR(-60);
      }
      animationFrameId = requestAnimationFrame(updateLoop);
    };

    animationFrameId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, setPlayheadPosition]);

  return {
    videoRef,
    activeVideoSrc,
    totalDuration,
    meterL,
    meterR,
    playheadPosition,
    isPlaying,
    setIsPlaying,
    inPoint,
    outPoint,
    setPlayheadPosition,
  };
}

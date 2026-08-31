import { useEffect, useRef, useState, useMemo } from "react";
import { useEditorStore } from "../../../stores/useEditorStore";
import { convertFileSrc } from "@tauri-apps/api/core";

export function useVideoPlayback() {
  const playheadPosition = useEditorStore((state) => state.playheadPosition);
  const setPlayheadPosition = useEditorStore((state) => state.setPlayheadPosition);
  const tracks = useEditorStore((state) => state.tracks);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const inPoint = useEditorStore((state) => state.inPoint);
  const outPoint = useEditorStore((state) => state.outPoint);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeVideoSrc, setActiveVideoSrc] = useState<string | null>(null);
  const [meterL, setMeterL] = useState(-60);
  const [meterR, setMeterR] = useState(-60);

  // Compute total sequence duration
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

  // Find the top-most active video clip at current playhead position (V2 has priority over V1)
  const activeClipInfo = useMemo(() => {
    const videoTracks = tracks.filter((t) => t.id.startsWith("v"));
    // Search in reverse (top track V2 first, then V1)
    for (let i = videoTracks.length - 1; i >= 0; i--) {
      const track = videoTracks[i];
      const clip = track.items.find(
        (item) =>
          playheadPosition >= (item.start || 0) &&
          playheadPosition < (item.start || 0) + (item.duration || 0)
      );
      if (clip && clip.src) {
        const relativeTime = (playheadPosition - (clip.start || 0)) + (clip.trimIn || 0);
        return { clip, relativeTime };
      }
    }
    return null;
  }, [tracks, playheadPosition]);

  // Sync active video src with active clip (turns null on timeline gap -> true black screen!)
  useEffect(() => {
    if (activeClipInfo) {
      try {
        const converted = convertFileSrc(activeClipInfo.clip.src!);
        setActiveVideoSrc((prev) => (prev === converted ? prev : converted));
      } catch (err) {
        console.error("Failed to convert video src:", err);
      }
    } else {
      // In timeline gap: clear video src to show black screen
      setActiveVideoSrc(null);
    }
  }, [activeClipInfo]);

  // Sync scrubbing / seeking to relative clip time
  useEffect(() => {
    if (!videoRef.current || !activeClipInfo) return;

    if (!isPlaying) {
      const targetTime = Math.max(0, activeClipInfo.relativeTime);
      if (Math.abs(videoRef.current.currentTime - targetTime) > 0.03) {
        videoRef.current.currentTime = targetTime;
      }
    }
  }, [activeClipInfo, isPlaying]);

  // Master Sequence Clock & Playback Loop
  useEffect(() => {
    if (!isPlaying) {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setMeterL(-60);
      setMeterR(-60);
      return;
    }

    let lastTime = performance.now();
    let animationFrameId: number;

    const sequenceTick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // Advance master sequence playhead
      const currentPlayhead = useEditorStore.getState().playheadPosition;
      let nextPlayhead = currentPlayhead + dt;

      // Check loop boundary if outPoint is set
      const currentOut = useEditorStore.getState().outPoint;
      const currentIn = useEditorStore.getState().inPoint;
      if (currentOut !== null && nextPlayhead >= currentOut) {
        nextPlayhead = currentIn || 0;
      }

      setPlayheadPosition(nextPlayhead);

      // Play video if an active clip exists at current position
      if (videoRef.current) {
        if (videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        }

        // Animate audio meter
        const base = -14 + Math.sin(now / 80) * 10;
        setMeterL(Math.max(-48, Math.min(-2, base + Math.random() * 4)));
        setMeterR(Math.max(-48, Math.min(-2, base + Math.random() * 5)));
      } else {
        setMeterL(-60);
        setMeterR(-60);
      }

      animationFrameId = requestAnimationFrame(sequenceTick);
    };

    animationFrameId = requestAnimationFrame(sequenceTick);
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

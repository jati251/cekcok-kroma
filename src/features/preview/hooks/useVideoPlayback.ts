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
  const activeClipIdRef = useRef<string | null>(null);
  const lastActiveClipIdRef = useRef<string | null>(null);

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

  // Find top-most active video clip at current playhead position (V2 > V1)
  const activeClip = useMemo(() => {
    const videoTracks = tracks.filter((t) => t.type === "video");
    for (let i = videoTracks.length - 1; i >= 0; i--) {
      const track = videoTracks[i];
      const clip = track.items.find(
        (item) =>
          playheadPosition >= (item.start || 0) &&
          playheadPosition < (item.start || 0) + (item.duration || 0)
      );
      if (clip && clip.src) {
        return clip;
      }
    }
    return null;
  }, [tracks, playheadPosition]);

  // Find active audio clip on ANY unmuted audio track (A1, A2)
  const activeAudioClip = useMemo(() => {
    const audioTracks = tracks.filter((t) => t.type === "audio" && !t.isMuted);
    for (const track of audioTracks) {
      const clip = track.items.find(
        (item) =>
          playheadPosition >= (item.start || 0) &&
          playheadPosition < (item.start || 0) + (item.duration || 0)
      );
      if (clip) return clip;
    }
    return null;
  }, [tracks, playheadPosition]);

  // Sync active video src ONLY when clip ID actually changes
  useEffect(() => {
    const currentId = activeClip ? activeClip.id : null;
    if (activeClipIdRef.current !== currentId) {
      activeClipIdRef.current = currentId;
      if (activeClip && activeClip.src) {
        try {
          const converted = convertFileSrc(activeClip.src);
          setActiveVideoSrc(converted);
        } catch (err) {
          console.error("Failed to convert video src:", err);
        }
      } else {
        setActiveVideoSrc(null);
      }
    }
  }, [activeClip]);

  // Audio Decoupling: Video audio is ONLY audible if an unmuted audio clip covers current playhead!
  useEffect(() => {
    if (!videoRef.current) return;
    if (activeAudioClip) {
      videoRef.current.muted = false;
    } else {
      videoRef.current.muted = true;
    }
  }, [activeAudioClip]);

  // Scrubbing & Seeking when paused
  useEffect(() => {
    if (isPlaying || !videoRef.current || !activeClip) return;

    const targetTime = Math.max(
      0,
      playheadPosition - (activeClip.start || 0) + (activeClip.trimIn || 0)
    );

    if (Math.abs(videoRef.current.currentTime - targetTime) > 0.02) {
      videoRef.current.currentTime = targetTime;
    }
  }, [playheadPosition, isPlaying, activeClip]);

  // Real-Time Hardware-Synchronized Playback Engine with Seamless Multi-Clip Transitions
  useEffect(() => {
    if (!isPlaying) {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
      setMeterL(-60);
      setMeterR(-60);
      lastActiveClipIdRef.current = null;
      return;
    }

    let animationFrameId: number;
    let lastPerfTime = performance.now();

    // Start video playback immediately if clip is active
    if (videoRef.current && activeClip) {
      const initialSeek = Math.max(
        0,
        playheadPosition - (activeClip.start || 0) + (activeClip.trimIn || 0)
      );
      videoRef.current.currentTime = initialSeek;
      videoRef.current.play().catch(() => {});
      lastActiveClipIdRef.current = activeClip.id;
    }

    const playbackTick = (now: number) => {
      const currentPlayhead = useEditorStore.getState().playheadPosition;
      const currentOut = useEditorStore.getState().outPoint;
      const currentIn = useEditorStore.getState().inPoint;

      // Loop handling if outPoint reached
      if (currentOut !== null && currentPlayhead >= currentOut) {
        const loopStart = currentIn || 0;
        setPlayheadPosition(loopStart);
        if (videoRef.current && activeClip) {
          videoRef.current.currentTime = Math.max(
            0,
            loopStart - (activeClip.start || 0) + (activeClip.trimIn || 0)
          );
        }
        animationFrameId = requestAnimationFrame(playbackTick);
        return;
      }

      // Check if clip transition occurred (e.g. adjacent clip 1 -> clip 2)
      const currentClipId = activeClip ? activeClip.id : null;
      if (currentClipId !== lastActiveClipIdRef.current) {
        lastActiveClipIdRef.current = currentClipId;
        if (videoRef.current && activeClip) {
          const seekTarget = Math.max(
            0,
            currentPlayhead - (activeClip.start || 0) + (activeClip.trimIn || 0)
          );
          videoRef.current.currentTime = seekTarget;
          videoRef.current.play().catch(() => {});
        }
      }

      if (videoRef.current && activeClip && !videoRef.current.paused) {
        const hardwareTime = videoRef.current.currentTime;
        const clipEndMediaTime = (activeClip.trimIn || 0) + (activeClip.duration || 0);

        if (hardwareTime >= clipEndMediaTime - 0.02) {
          // Seamlessly advance playhead to the next clip's start boundary
          const nextStart = (activeClip.start || 0) + (activeClip.duration || 0);
          setPlayheadPosition(nextStart);
        } else {
          const newPos = (activeClip.start || 0) + (hardwareTime - (activeClip.trimIn || 0));
          setPlayheadPosition(newPos);
        }

        // Audio VU meter (active only if audio track is unmuted)
        if (activeAudioClip) {
          const base = -14 + Math.sin(now / 70) * 10;
          setMeterL(Math.max(-48, Math.min(-2, base + Math.random() * 4)));
          setMeterR(Math.max(-48, Math.min(-2, base + Math.random() * 5)));
        } else {
          setMeterL(-60);
          setMeterR(-60);
        }
      } else {
        // Gap on timeline or video buffering
        const dt = (now - lastPerfTime) / 1000;
        setPlayheadPosition(currentPlayhead + dt);
        setMeterL(-60);
        setMeterR(-60);
      }

      lastPerfTime = now;
      animationFrameId = requestAnimationFrame(playbackTick);
    };

    animationFrameId = requestAnimationFrame(playbackTick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, activeClip, activeAudioClip, setPlayheadPosition]);

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

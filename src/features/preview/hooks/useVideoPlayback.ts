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

  // Ping-Pong Double-Buffered Video References & Synchronous Slot Tracking
  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);
  const activeSlotRef = useRef<"A" | "B">("A");
  const [activeSlot, setActiveSlot] = useState<"A" | "B">("A");

  const [srcA, setSrcA] = useState<string | null>(null);
  const [srcB, setSrcB] = useState<string | null>(null);

  // Play Promise tracker for rapid play/pause without AbortError or decoder stall
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  isPlayingRef.current = isPlaying;

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

  // Pre-load lookup: find the NEXT adjacent video clip on the timeline
  const nextClip = useMemo(() => {
    if (!activeClip) return null;
    const currentEnd = (activeClip.start || 0) + (activeClip.duration || 0);
    const videoTracks = tracks.filter((t) => t.type === "video");

    for (let i = videoTracks.length - 1; i >= 0; i--) {
      const track = videoTracks[i];
      const found = track.items.find(
        (item) =>
          item.id !== activeClip.id &&
          Math.abs((item.start || 0) - currentEnd) <= 0.08
      );
      if (found && found.src) {
        return found;
      }
    }
    return null;
  }, [tracks, activeClip]);

  // Active audio clip on any unmuted audio track
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

  // Sync Active & Standby Sources (Dual-Buffer Preloading)
  useEffect(() => {
    const convertedActive = activeClip?.src ? convertFileSrc(activeClip.src) : null;
    const convertedNext = nextClip?.src ? convertFileSrc(nextClip.src) : null;

    if (activeSlot === "A") {
      setSrcA((prev) => (prev !== convertedActive ? convertedActive : prev));
      if (convertedNext) {
        setSrcB((prev) => (prev !== convertedNext ? convertedNext : prev));
      }
    } else {
      setSrcB((prev) => (prev !== convertedActive ? convertedActive : prev));
      if (convertedNext) {
        setSrcA((prev) => (prev !== convertedNext ? convertedNext : prev));
      }
    }
  }, [activeClip, nextClip, activeSlot]);

  // Pre-seek standby video buffer to next clip's trimIn so it is primed in GPU memory
  useEffect(() => {
    if (!nextClip) return;
    const standbyEl = activeSlotRef.current === "A" ? videoRefB.current : videoRefA.current;
    if (standbyEl && standbyEl.readyState >= 1) {
      const target = nextClip.trimIn || 0;
      if (Math.abs(standbyEl.currentTime - target) > 0.05) {
        standbyEl.currentTime = target;
      }
    }
  }, [nextClip, activeSlot]);

  // Audio Decoupling: Audio plays only when an unmuted audio clip covers current playhead
  useEffect(() => {
    const activeEl = activeSlotRef.current === "A" ? videoRefA.current : videoRefB.current;
    const standbyEl = activeSlotRef.current === "A" ? videoRefB.current : videoRefA.current;

    if (activeEl) {
      activeEl.muted = !activeAudioClip;
    }
    if (standbyEl) {
      standbyEl.muted = true;
    }
  }, [activeAudioClip, activeSlot]);

  // Scrubbing & Seeking when paused: only seek if position actually changed
  useEffect(() => {
    if (isPlaying || !activeClip) return;
    const activeEl = activeSlotRef.current === "A" ? videoRefA.current : videoRefB.current;
    if (!activeEl) return;

    const targetTime = Math.max(
      0,
      playheadPosition - (activeClip.start || 0) + (activeClip.trimIn || 0)
    );

    if (Math.abs(activeEl.currentTime - targetTime) > 0.02) {
      activeEl.currentTime = targetTime;
    }
  }, [playheadPosition, isPlaying, activeClip]);

  // Rapid Play / Pause Handler: Zero Stutter, No Buffer Flush
  useEffect(() => {
    const activeEl = activeSlotRef.current === "A" ? videoRefA.current : videoRefB.current;

    if (!isPlaying) {
      if (activeEl) {
        if (playPromiseRef.current) {
          playPromiseRef.current
            .then(() => {
              if (!isPlayingRef.current && activeEl && !activeEl.paused) {
                activeEl.pause();
              }
            })
            .catch(() => {});
        } else if (!activeEl.paused) {
          activeEl.pause();
        }
      }
      setMeterL(-60);
      setMeterR(-60);
      return;
    }

    // Resuming playback: only seek if displaced, otherwise start immediately without decoder flush!
    if (activeEl && activeClip) {
      const expectedTime = Math.max(
        0,
        playheadPosition - (activeClip.start || 0) + (activeClip.trimIn || 0)
      );

      // ONLY seek if the user scrubbed to a different time while paused
      if (Math.abs(activeEl.currentTime - expectedTime) > 0.05) {
        activeEl.currentTime = expectedTime;
      }

      if (activeEl.paused) {
        playPromiseRef.current = activeEl.play().catch(() => {});
      }
    }
  }, [isPlaying, activeClip]);

  // Master Synchronous Playback Loop with Synchronous Slot Swapping
  useEffect(() => {
    if (!isPlaying) return;

    let animationFrameId: number;
    let lastPerfTime = performance.now();

    const playbackTick = (now: number) => {
      // Always query slot synchronously from Ref
      const currentSlot = activeSlotRef.current;
      const activeEl = currentSlot === "A" ? videoRefA.current : videoRefB.current;
      const standbyEl = currentSlot === "A" ? videoRefB.current : videoRefA.current;

      const currentPlayhead = useEditorStore.getState().playheadPosition;
      const currentOut = useEditorStore.getState().outPoint;
      const currentIn = useEditorStore.getState().inPoint;

      // Loop handling
      if (currentOut !== null && currentPlayhead >= currentOut) {
        const loopStart = currentIn || 0;
        setPlayheadPosition(loopStart);
        if (activeEl && activeClip) {
          activeEl.currentTime = Math.max(
            0,
            loopStart - (activeClip.start || 0) + (activeClip.trimIn || 0)
          );
        }
        animationFrameId = requestAnimationFrame(playbackTick);
        return;
      }

      if (activeEl && activeClip && !activeEl.paused) {
        const hardwareTime = activeEl.currentTime;
        const clipEndMediaTime = (activeClip.trimIn || 0) + (activeClip.duration || 0);

        // Gapless seamless transition check
        if (hardwareTime >= clipEndMediaTime - 0.02) {
          if (nextClip && standbyEl) {
            // SYNCHRONOUS PING-PONG SWAP (0ms Latency!)
            activeEl.pause();
            standbyEl.currentTime = nextClip.trimIn || 0;
            playPromiseRef.current = standbyEl.play().catch(() => {});

            // Flip ref immediately so next tick immediately reads the new element!
            const newSlot = currentSlot === "A" ? "B" : "A";
            activeSlotRef.current = newSlot;
            setActiveSlot(newSlot); // Update React UI opacity
            setPlayheadPosition(nextClip.start || 0);
          } else {
            const nextBoundary = (activeClip.start || 0) + (activeClip.duration || 0);
            setPlayheadPosition(nextBoundary);
          }
        } else {
          const newPos = (activeClip.start || 0) + (hardwareTime - (activeClip.trimIn || 0));
          setPlayheadPosition(newPos);
        }

        // Audio VU meter
        if (activeAudioClip) {
          const base = -14 + Math.sin(now / 70) * 10;
          setMeterL(Math.max(-48, Math.min(-2, base + Math.random() * 4)));
          setMeterR(Math.max(-48, Math.min(-2, base + Math.random() * 5)));
        } else {
          setMeterL(-60);
          setMeterR(-60);
        }
      } else {
        // Gap or video buffering
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
  }, [isPlaying, activeClip, nextClip, activeAudioClip, setPlayheadPosition]);

  // Primary active ref for external interactions (canvas snapshot, master volume, etc.)
  const activeVideoRef = activeSlot === "A" ? videoRefA : videoRefB;

  return {
    videoRef: activeVideoRef,
    videoRefA,
    videoRefB,
    srcA,
    srcB,
    activeSlot,
    hasMedia: !!activeClip,
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

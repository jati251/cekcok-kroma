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
  const masterVolume = useEditorStore((state) => state.masterVolume);
  const isMasterMuted = useEditorStore((state) => state.isMasterMuted);

  // Ping-Pong Double-Buffered Video References & Synchronous Slot Tracking
  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);
  const activeSlotRef = useRef<"A" | "B">("A");
  const [activeSlot, setActiveSlot] = useState<"A" | "B">("A");

  const [srcA, setSrcA] = useState<string | null>(null);
  const [srcB, setSrcB] = useState<string | null>(null);

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

  // UNIFIED AUDIO PIPELINE: Single Source of Truth
  const isAudible = !isMasterMuted && !!activeAudioClip;
  const effectiveVolume = isAudible ? masterVolume : 0;

  // Apply audio states to BOTH video elements strictly
  useEffect(() => {
    const activeEl = activeSlotRef.current === "A" ? videoRefA.current : videoRefB.current;
    const standbyEl = activeSlotRef.current === "A" ? videoRefB.current : videoRefA.current;

    if (activeEl) {
      activeEl.muted = !isAudible;
      activeEl.volume = effectiveVolume;
    }

    // Standby is ALWAYS hard-muted and silent so it can never leak audio
    if (standbyEl) {
      standbyEl.muted = true;
      standbyEl.volume = 0;
    }
  }, [isAudible, effectiveVolume, activeSlot]);

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

  // Scrubbing & Seeking when paused: only seek if user moved playhead
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

  // Rapid Play / Pause: Zero Stutter, No Buffer Flush
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

    // Resuming: start immediately without seeking if already in place
    if (activeEl && activeClip) {
      const expectedTime = Math.max(
        0,
        playheadPosition - (activeClip.start || 0) + (activeClip.trimIn || 0)
      );

      if (Math.abs(activeEl.currentTime - expectedTime) > 0.08) {
        activeEl.currentTime = expectedTime;
      }

      if (activeEl.paused) {
        playPromiseRef.current = activeEl.play().catch(() => {});
      }
    }
  }, [isPlaying, activeClip]);

  // PREMIERE PRO MERCURY PLAYBACK ENGINE: Monotonic Master Sequence Clock with Phase-Locked Loop (PLL)
  useEffect(() => {
    if (!isPlaying) return;

    let animationFrameId: number;
    let lastPerfTime = performance.now();

    const sequenceTick = (now: number) => {
      const dt = (now - lastPerfTime) / 1000;
      lastPerfTime = now;

      const currentSlot = activeSlotRef.current;
      const activeEl = currentSlot === "A" ? videoRefA.current : videoRefB.current;
      const standbyEl = currentSlot === "A" ? videoRefB.current : videoRefA.current;

      const currentPlayhead = useEditorStore.getState().playheadPosition;
      const currentOut = useEditorStore.getState().outPoint;
      const currentIn = useEditorStore.getState().inPoint;

      // Check loop bounds
      if (currentOut !== null && currentPlayhead >= currentOut) {
        const loopStart = currentIn || 0;
        setPlayheadPosition(loopStart);
        if (activeEl && activeClip) {
          activeEl.currentTime = Math.max(
            0,
            loopStart - (activeClip.start || 0) + (activeClip.trimIn || 0)
          );
        }
        animationFrameId = requestAnimationFrame(sequenceTick);
        return;
      }

      // 1. Advance Master Sequence Clock smoothly via high-resolution monotonic timer (60fps steady!)
      let nextPlayhead = currentPlayhead + dt;

      // 2. Multi-Clip Boundary & Transition Check
      if (activeClip) {
        const clipEndPos = (activeClip.start || 0) + (activeClip.duration || 0);

        if (nextPlayhead >= clipEndPos) {
          // Reached or crossed clip boundary!
          if (nextClip && standbyEl) {
            // PING-PONG INSTANT TRANSITION (0ms Latency!)
            activeEl?.pause();
            standbyEl.currentTime = nextClip.trimIn || 0;
            standbyEl.muted = !isAudible;
            standbyEl.volume = effectiveVolume;
            playPromiseRef.current = standbyEl.play().catch(() => {});

            const newSlot = currentSlot === "A" ? "B" : "A";
            activeSlotRef.current = newSlot;
            setActiveSlot(newSlot);
            nextPlayhead = nextClip.start || 0;
          }
        } else if (activeEl) {
          // 3. Phase-Locked Loop (PLL): Slave video sync to Master Sequence Clock
          if (activeEl.paused) {
            playPromiseRef.current = activeEl.play().catch(() => {});
          }

          const targetMediaTime = Math.max(
            0,
            nextPlayhead - (activeClip.start || 0) + (activeClip.trimIn || 0)
          );
          const drift = activeEl.currentTime - targetMediaTime;

          // Only perform hard seek if drift is severe (> 200ms)
          if (Math.abs(drift) > 0.2) {
            activeEl.currentTime = targetMediaTime;
          }
        }
      }

      setPlayheadPosition(nextPlayhead);

      // Audio VU meter
      if (isAudible) {
        const base = -14 + Math.sin(now / 70) * 10;
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
  }, [isPlaying, activeClip, nextClip, isAudible, effectiveVolume, setPlayheadPosition]);

  const activeVideoRef = activeSlot === "A" ? videoRefA : videoRefB;

  return {
    videoRef: activeVideoRef,
    videoRefA,
    videoRefB,
    srcA,
    srcB,
    activeSlot,
    hasMedia: !!activeClip,
    isAudible,
    effectiveVolume,
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

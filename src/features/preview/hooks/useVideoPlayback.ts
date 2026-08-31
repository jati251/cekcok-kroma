import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useEditorStore } from "../../../stores/useEditorStore";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";

export interface PlaybackSegment {
  id: string;
  src: string;
  trackId: string;
  timelineStart: number;
  timelineEnd: number;
  trimIn: number;
  duration: number;
  hasAudio: boolean;
  width?: number;
  height?: number;
}

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

  // Dual-deck ping-pong video player references
  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);
  const activeSlotRef = useRef<"A" | "B">("A");
  const [activeSlot, setActiveSlot] = useState<"A" | "B">("A");

  const [srcA, setSrcA] = useState<string | null>(null);
  const [srcB, setSrcB] = useState<string | null>(null);

  // Compiled schedule from Rust sequence compiler
  const [schedule, setSchedule] = useState<PlaybackSegment[]>([]);
  const scheduleRef = useRef<PlaybackSegment[]>([]);
  scheduleRef.current = schedule;

  const playPromiseRef = useRef<Promise<void> | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  isPlayingRef.current = isPlaying;

  const [meterL, setMeterL] = useState(-60);
  const [meterR, setMeterR] = useState(-60);

  // Sync sequence schedule from Rust whenever tracks change
  useEffect(() => {
    let cancelled = false;
    invoke<PlaybackSegment[]>("get_playback_schedule")
      .then((segs) => {
        if (!cancelled) {
          setSchedule(segs);
        }
      })
      .catch((err) => {
        console.error("Failed to get playback schedule from Rust:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [tracks]);

  // Compute total sequence duration
  const totalDuration = useMemo(() => {
    if (schedule.length > 0) {
      return Math.max(schedule[schedule.length - 1].timelineEnd, 10);
    }
    let max = 0;
    tracks.forEach((t) => {
      t.items.forEach((item) => {
        const end = (item.start || 0) + (item.duration || 0);
        if (end > max) max = end;
      });
    });
    return Math.max(max, 10);
  }, [schedule, tracks]);

  // Helper to find segment at any timeline timestamp
  const getSegmentAt = useCallback((time: number): PlaybackSegment | null => {
    const list = scheduleRef.current;
    for (const seg of list) {
      if (time >= seg.timelineStart && time < seg.timelineEnd) {
        return seg;
      }
    }
    return null;
  }, []);

  // Helper to find next segment after current timestamp
  const getNextSegmentAfter = useCallback((time: number): PlaybackSegment | null => {
    const list = scheduleRef.current;
    for (const seg of list) {
      if (seg.timelineStart >= time - 0.01) {
        return seg;
      }
    }
    return null;
  }, []);

  // Active audio detection
  const isAudioActiveAt = useCallback((time: number): boolean => {
    const audioTracks = tracks.filter((t) => t.type === "audio" && !t.isMuted);
    for (const track of audioTracks) {
      const clip = track.items.find(
        (item) => time >= (item.start || 0) && time < (item.start || 0) + (item.duration || 0)
      );
      if (clip) return true;
    }
    return false;
  }, [tracks]);

  const currentSegment = useMemo(() => getSegmentAt(playheadPosition), [getSegmentAt, playheadPosition, schedule]);
  const isAudible = !isMasterMuted && isAudioActiveAt(playheadPosition);
  const effectiveVolume = isAudible ? masterVolume : 0;

  // Sync sources & pre-load standby deck when active segment changes
  useEffect(() => {
    if (!currentSegment) {
      // Check if there is an upcoming segment to pre-load
      const nextUpcoming = getNextSegmentAfter(playheadPosition);
      if (nextUpcoming) {
        const converted = convertFileSrc(nextUpcoming.src);
        if (activeSlot === "A") {
          setSrcA(converted);
        } else {
          setSrcB(converted);
        }
      }
      return;
    }

    const currentSrcConverted = convertFileSrc(currentSegment.src);
    const nextSeg = getNextSegmentAfter(currentSegment.timelineEnd);
    const nextSrcConverted = nextSeg ? convertFileSrc(nextSeg.src) : null;

    if (activeSlot === "A") {
      setSrcA(currentSrcConverted);
      if (nextSrcConverted) {
        setSrcB(nextSrcConverted);
      }
    } else {
      setSrcB(currentSrcConverted);
      if (nextSrcConverted) {
        setSrcA(nextSrcConverted);
      }
    }
  }, [currentSegment, activeSlot, playheadPosition, getNextSegmentAfter]);

  // Apply volume and mute strictly to the active video element
  useEffect(() => {
    const activeEl = activeSlotRef.current === "A" ? videoRefA.current : videoRefB.current;
    const standbyEl = activeSlotRef.current === "A" ? videoRefB.current : videoRefA.current;

    if (activeEl) {
      activeEl.muted = !isAudible;
      activeEl.volume = effectiveVolume;
    }
    if (standbyEl) {
      standbyEl.muted = true;
      standbyEl.volume = 0;
    }
  }, [isAudible, effectiveVolume, activeSlot]);

  // PAUSED SCRUBBING / SEEKING: ONLY when NOT playing!
  // This completely eliminates seek interference during active playback.
  useEffect(() => {
    if (isPlaying) return;

    const activeEl = activeSlotRef.current === "A" ? videoRefA.current : videoRefB.current;
    if (!activeEl || !currentSegment) return;

    const targetMediaTime = Math.max(
      0,
      currentSegment.trimIn + (playheadPosition - currentSegment.timelineStart)
    );

    if (Math.abs(activeEl.currentTime - targetMediaTime) > 0.03) {
      activeEl.currentTime = targetMediaTime;
    }
  }, [playheadPosition, isPlaying, currentSegment]);

  // RAPID PLAY / PAUSE HANDLER
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

    // Starting playback: ensure active deck is ready and start immediately
    if (activeEl && currentSegment) {
      const targetMediaTime = Math.max(
        0,
        currentSegment.trimIn + (playheadPosition - currentSegment.timelineStart)
      );

      // Only seek on play start if significantly off position (> 100ms)
      if (Math.abs(activeEl.currentTime - targetMediaTime) > 0.1) {
        activeEl.currentTime = targetMediaTime;
      }

      if (activeEl.paused) {
        playPromiseRef.current = activeEl.play().catch(() => {});
      }
    }
  }, [isPlaying]); // STRICT DEPENDENCY: Only triggers on play/pause toggle!

  // PREMIERE PRO MERCURY PLAYBACK ENGINE:
  // Hardware Media Clock is MASTER. No synthetic seeking during playback.
  useEffect(() => {
    if (!isPlaying) return;

    let animationFrameId: number;
    let lastPerfTime = performance.now();

    const playbackLoop = (now: number) => {
      const dt = (now - lastPerfTime) / 1000;
      lastPerfTime = now;

      const currentSlot = activeSlotRef.current;
      const activeEl = currentSlot === "A" ? videoRefA.current : videoRefB.current;
      const standbyEl = currentSlot === "A" ? videoRefB.current : videoRefA.current;

      const currentPlayhead = useEditorStore.getState().playheadPosition;
      const currentOut = useEditorStore.getState().outPoint;
      const currentIn = useEditorStore.getState().inPoint;

      // 1. Check Loop Out Point
      if (currentOut !== null && currentPlayhead >= currentOut) {
        const loopStart = currentIn || 0;
        setPlayheadPosition(loopStart);
        const seg = getSegmentAt(loopStart);
        if (activeEl && seg) {
          activeEl.currentTime = seg.trimIn + (loopStart - seg.timelineStart);
        }
        animationFrameId = requestAnimationFrame(playbackLoop);
        return;
      }

      // 2. Active Segment Evaluation
      const activeSeg = getSegmentAt(currentPlayhead);

      if (activeSeg) {
        // CASE A: Inside an active video clip
        if (activeEl) {
          // Ensure video is playing
          if (activeEl.paused && activeEl.readyState >= 2) {
            playPromiseRef.current = activeEl.play().catch(() => {});
          }

          // DERIVE Master Sequence Time DIRECTLY from hardware video clock!
          const mediaElapsed = Math.max(0, activeEl.currentTime - activeSeg.trimIn);
          const hardwareSeqTime = activeSeg.timelineStart + mediaElapsed;

          // Seamless Clip Transition Check (Cut Boundary)
          if (hardwareSeqTime >= activeSeg.timelineEnd - 0.03 || activeEl.ended) {
            // Segment has reached its cut boundary!
            const nextSeg = getNextSegmentAfter(activeSeg.timelineEnd);

            if (nextSeg && Math.abs(nextSeg.timelineStart - activeSeg.timelineEnd) <= 0.08 && standbyEl) {
              // SEAMLESS PING-PONG CUT SWITCH (0ms latency, zero gap)
              activeEl.pause();
              standbyEl.currentTime = nextSeg.trimIn;
              standbyEl.muted = !isAudioActiveAt(nextSeg.timelineStart);
              standbyEl.volume = masterVolume;
              playPromiseRef.current = standbyEl.play().catch(() => {});

              const newSlot = currentSlot === "A" ? "B" : "A";
              activeSlotRef.current = newSlot;
              setActiveSlot(newSlot);

              setPlayheadPosition(nextSeg.timelineStart);
            } else if (nextSeg) {
              // There is a gap between clips: pause video, let timer advance across gap
              activeEl.pause();
              setPlayheadPosition(currentPlayhead + dt);
            } else {
              // Reached sequence end!
              setIsPlaying(false);
              setPlayheadPosition(activeSeg.timelineEnd);
              return;
            }
          } else {
            // Normal forward playback: playhead tracks hardware video position perfectly
            setPlayheadPosition(hardwareSeqTime);
          }
        } else {
          setPlayheadPosition(currentPlayhead + dt);
        }
      } else {
        // CASE B: In a gap or empty area between clips
        const nextUpcoming = getNextSegmentAfter(currentPlayhead);
        const nextPlayhead = currentPlayhead + dt;

        if (nextUpcoming && nextPlayhead >= nextUpcoming.timelineStart) {
          // Arrived at upcoming clip!
          if (activeEl) {
            activeEl.currentTime = nextUpcoming.trimIn;
            playPromiseRef.current = activeEl.play().catch(() => {});
          }
          setPlayheadPosition(nextUpcoming.timelineStart);
        } else if (nextUpcoming) {
          // Still in gap: advance time smoothly
          setPlayheadPosition(nextPlayhead);
        } else {
          // Beyond end of sequence
          setIsPlaying(false);
          return;
        }
      }

      // 3. Audio VU Meter
      if (!useEditorStore.getState().isMasterMuted && isAudioActiveAt(useEditorStore.getState().playheadPosition)) {
        const base = -14 + Math.sin(now / 70) * 10;
        setMeterL(Math.max(-48, Math.min(-2, base + Math.random() * 4)));
        setMeterR(Math.max(-48, Math.min(-2, base + Math.random() * 5)));
      } else {
        setMeterL(-60);
        setMeterR(-60);
      }

      animationFrameId = requestAnimationFrame(playbackLoop);
    };

    animationFrameId = requestAnimationFrame(playbackLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, getSegmentAt, getNextSegmentAfter, isAudioActiveAt, masterVolume, setIsPlaying, setPlayheadPosition]);

  const activeVideoRef = activeSlot === "A" ? videoRefA : videoRefB;

  return {
    videoRef: activeVideoRef,
    videoRefA,
    videoRefB,
    srcA,
    srcB,
    activeSlot,
    hasMedia: !!currentSegment || schedule.length > 0,
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

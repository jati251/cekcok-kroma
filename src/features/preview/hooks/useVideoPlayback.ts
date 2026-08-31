import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useEditorStore } from "../../../stores/useEditorStore";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { MultiTrackAudioMixer } from "../utils/audioMixer";

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

  // Track which segment ID is currently pre-seeked on the standby deck
  const preSeekedSegmentIdRef = useRef<string | null>(null);

  // Dedicated Multi-Track Audio Mixer (independent of video canvas)
  const audioMixerRef = useRef<MultiTrackAudioMixer>(new MultiTrackAudioMixer());

  // Compiled schedule from Rust sequence compiler
  const [schedule, setSchedule] = useState<PlaybackSegment[]>([]);
  const scheduleRef = useRef<PlaybackSegment[]>([]);
  scheduleRef.current = schedule;

  const playPromiseRef = useRef<Promise<void> | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  isPlayingRef.current = isPlaying;

  const [meterL, setMeterL] = useState(-60);
  const [meterR, setMeterR] = useState(-60);

  // Update audio mixer settings
  useEffect(() => {
    audioMixerRef.current.setMasterVolume(masterVolume);
    audioMixerRef.current.setMasterMute(isMasterMuted);
  }, [masterVolume, isMasterMuted]);

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

  const currentSegment = useMemo(() => getSegmentAt(playheadPosition), [getSegmentAt, playheadPosition, schedule]);

  // PRE-LOAD & PRE-SEEK STANDBY DECK ONCE PER SEGMENT CHANGE (Zero-Stutter Cut Engine)
  useEffect(() => {
    const standbyEl = activeSlotRef.current === "A" ? videoRefB.current : videoRefA.current;

    if (!currentSegment) {
      const nextUpcoming = getNextSegmentAfter(playheadPosition);
      if (nextUpcoming) {
        const converted = convertFileSrc(nextUpcoming.src);
        if (activeSlot === "A") {
          setSrcA((prev) => (prev !== converted ? converted : prev));
        } else {
          setSrcB((prev) => (prev !== converted ? converted : prev));
        }
      }
      return;
    }

    const currentSrcConverted = convertFileSrc(currentSegment.src);
    const nextSeg = getNextSegmentAfter(currentSegment.timelineEnd);
    const nextSrcConverted = nextSeg ? convertFileSrc(nextSeg.src) : null;

    if (activeSlot === "A") {
      setSrcA((prev) => (prev !== currentSrcConverted ? currentSrcConverted : prev));
      if (nextSrcConverted) {
        setSrcB((prev) => (prev !== nextSrcConverted ? nextSrcConverted : prev));
      }
    } else {
      setSrcB((prev) => (prev !== currentSrcConverted ? currentSrcConverted : prev));
      if (nextSrcConverted) {
        setSrcA((prev) => (prev !== nextSrcConverted ? nextSrcConverted : prev));
      }
    }

    // PRE-SEEK Standby Deck ONCE (prevent continuous seek reset)
    if (nextSeg && nextSeg.id !== preSeekedSegmentIdRef.current && standbyEl) {
      preSeekedSegmentIdRef.current = nextSeg.id;
      const targetTime = nextSeg.trimIn;

      const doSeek = () => {
        try {
          standbyEl.currentTime = targetTime;
        } catch {}
      };

      if (standbyEl.readyState >= 1) {
        doSeek();
      } else {
        standbyEl.addEventListener("loadedmetadata", doSeek, { once: true });
      }
    }
  }, [currentSegment?.id, activeSlot, getNextSegmentAfter]);

  // Canvas videos are kept permanently muted because MultiTrackAudioMixer handles all sound!
  useEffect(() => {
    if (videoRefA.current) {
      videoRefA.current.muted = true;
      videoRefA.current.volume = 0;
    }
    if (videoRefB.current) {
      videoRefB.current.muted = true;
      videoRefB.current.volume = 0;
    }
  }, []);

  // PAUSED SCRUBBING / SEEKING: ONLY when NOT playing!
  useEffect(() => {
    if (isPlaying) return;

    // Sync audio tracks when scrubbed while paused
    audioMixerRef.current.sync(playheadPosition, tracks, false);

    const activeEl = activeSlotRef.current === "A" ? videoRefA.current : videoRefB.current;
    if (!activeEl || !currentSegment) return;

    const targetMediaTime = Math.max(
      0,
      currentSegment.trimIn + (playheadPosition - currentSegment.timelineStart)
    );

    if (Math.abs(activeEl.currentTime - targetMediaTime) > 0.03) {
      try {
        activeEl.currentTime = targetMediaTime;
      } catch {}
    }
  }, [playheadPosition, isPlaying, currentSegment, tracks]);

  // RAPID PLAY / PAUSE HANDLER
  useEffect(() => {
    const activeEl = activeSlotRef.current === "A" ? videoRefA.current : videoRefB.current;

    if (!isPlaying) {
      audioMixerRef.current.pauseAll();
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

    // Starting playback
    audioMixerRef.current.sync(playheadPosition, tracks, true);

    if (activeEl && currentSegment) {
      const targetMediaTime = Math.max(
        0,
        currentSegment.trimIn + (playheadPosition - currentSegment.timelineStart)
      );

      if (Math.abs(activeEl.currentTime - targetMediaTime) > 0.08) {
        try {
          activeEl.currentTime = targetMediaTime;
        } catch {}
      }

      if (activeEl.paused) {
        playPromiseRef.current = activeEl.play().catch(() => {});
      }
    }
  }, [isPlaying]);

  // PREMIERE PRO MERCURY PLAYBACK ENGINE:
  // Zero-Stutter Pre-Rolled Transitions + Multi-Track Audio Sync
  useEffect(() => {
    if (!isPlaying) return;

    let animationFrameId: number;
    let lastPerfTime = performance.now();
    let isStandbyPreRolling = false;

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
          try {
            activeEl.currentTime = seg.trimIn + (loopStart - seg.timelineStart);
          } catch {}
        }
        audioMixerRef.current.sync(loopStart, tracks, true);
        isStandbyPreRolling = false;
        animationFrameId = requestAnimationFrame(playbackLoop);
        return;
      }

      // 2. Active Segment Evaluation
      const activeSeg = getSegmentAt(currentPlayhead);

      if (activeSeg) {
        // Inside an active video clip
        if (activeEl) {
          if (activeEl.paused && activeEl.readyState >= 2) {
            playPromiseRef.current = activeEl.play().catch(() => {});
          }

          // DERIVE Master Sequence Time from hardware video clock
          const mediaElapsed = Math.max(0, activeEl.currentTime - activeSeg.trimIn);
          const hardwareSeqTime = activeSeg.timelineStart + mediaElapsed;
          const timeToCut = activeSeg.timelineEnd - hardwareSeqTime;

          const nextSeg = getNextSegmentAfter(activeSeg.timelineEnd);
          const isAdjacentCut = nextSeg && Math.abs(nextSeg.timelineStart - activeSeg.timelineEnd) <= 0.08;

          // PRE-ROLL DECK B 100ms BEFORE CUT: Start decoding frames in background!
          if (isAdjacentCut && standbyEl && timeToCut <= 0.12 && timeToCut > 0 && !isStandbyPreRolling) {
            isStandbyPreRolling = true;
            standbyEl.play().catch(() => {});
          }

          // AT CUT BOUNDARY (0ms instant switch)
          if (hardwareSeqTime >= activeSeg.timelineEnd - 0.02 || activeEl.ended) {
            if (isAdjacentCut && standbyEl) {
              // Switch active slot instantaneously
              const newSlot = currentSlot === "A" ? "B" : "A";
              activeSlotRef.current = newSlot;
              setActiveSlot(newSlot);

              // Direct DOM opacity update to prevent 1-frame React render delay!
              if (videoRefA.current && videoRefB.current) {
                if (newSlot === "B") {
                  videoRefB.current.style.opacity = "1";
                  videoRefB.current.style.zIndex = "10";
                  videoRefA.current.style.opacity = "0";
                  videoRefA.current.style.zIndex = "0";
                } else {
                  videoRefA.current.style.opacity = "1";
                  videoRefA.current.style.zIndex = "10";
                  videoRefB.current.style.opacity = "0";
                  videoRefB.current.style.zIndex = "0";
                }
              }

              activeEl.pause();
              isStandbyPreRolling = false;
              preSeekedSegmentIdRef.current = null;

              setPlayheadPosition(nextSeg.timelineStart);
              audioMixerRef.current.sync(nextSeg.timelineStart, tracks, true);
            } else if (nextSeg) {
              // Gap between clips
              activeEl.pause();
              isStandbyPreRolling = false;
              const nextTime = currentPlayhead + dt;
              setPlayheadPosition(nextTime);
              audioMixerRef.current.sync(nextTime, tracks, true);
            } else {
              // Reached sequence end
              setIsPlaying(false);
              setPlayheadPosition(activeSeg.timelineEnd);
              audioMixerRef.current.pauseAll();
              return;
            }
          } else {
            // Normal forward playback
            setPlayheadPosition(hardwareSeqTime);
            audioMixerRef.current.sync(hardwareSeqTime, tracks, true);
          }
        } else {
          const nextTime = currentPlayhead + dt;
          setPlayheadPosition(nextTime);
          audioMixerRef.current.sync(nextTime, tracks, true);
        }
      } else {
        // Gap or empty area
        const nextUpcoming = getNextSegmentAfter(currentPlayhead);
        const nextPlayhead = currentPlayhead + dt;

        if (nextUpcoming && nextPlayhead >= nextUpcoming.timelineStart) {
          if (activeEl) {
            try {
              activeEl.currentTime = nextUpcoming.trimIn;
            } catch {}
            playPromiseRef.current = activeEl.play().catch(() => {});
          }
          setPlayheadPosition(nextUpcoming.timelineStart);
          audioMixerRef.current.sync(nextUpcoming.timelineStart, tracks, true);
        } else if (nextUpcoming) {
          setPlayheadPosition(nextPlayhead);
          audioMixerRef.current.sync(nextPlayhead, tracks, true);
        } else {
          setIsPlaying(false);
          audioMixerRef.current.pauseAll();
          return;
        }
      }

      // 3. Audio VU Meter
      const activeVoiceCount = audioMixerRef.current.getActiveVoiceCount();
      if (!isMasterMuted && activeVoiceCount > 0) {
        const base = -16 + Math.min(10, activeVoiceCount * 3) + Math.sin(now / 70) * 8;
        setMeterL(Math.max(-48, Math.min(-1, base + Math.random() * 4)));
        setMeterR(Math.max(-48, Math.min(-1, base + Math.random() * 5)));
      } else {
        setMeterL(-60);
        setMeterR(-60);
      }

      animationFrameId = requestAnimationFrame(playbackLoop);
    };

    animationFrameId = requestAnimationFrame(playbackLoop);
    return () => {
      cancelAnimationFrame(animationFrameId);
      audioMixerRef.current.pauseAll();
    };
  }, [isPlaying, getSegmentAt, getNextSegmentAfter, tracks, isMasterMuted, setIsPlaying, setPlayheadPosition]);

  const activeVideoRef = activeSlot === "A" ? videoRefA : videoRefB;

  return {
    videoRef: activeVideoRef,
    videoRefA,
    videoRefB,
    srcA,
    srcB,
    activeSlot,
    hasMedia: !!currentSegment || schedule.length > 0,
    isAudible: !isMasterMuted && audioMixerRef.current.getActiveVoiceCount() > 0,
    effectiveVolume: isMasterMuted ? 0 : masterVolume,
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

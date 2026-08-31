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

export interface PlaybackSchedule {
  videoSegments: PlaybackSegment[];
  audioSegments: PlaybackSegment[];
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Hidden video elements map
  const videoCacheRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const frameCacheRef = useRef<Map<string, ImageBitmap>>(new Map());

  const audioMixerRef = useRef<MultiTrackAudioMixer>(new MultiTrackAudioMixer());

  const [schedule, setSchedule] = useState<PlaybackSchedule>({ videoSegments: [], audioSegments: [] });
  const scheduleRef = useRef<PlaybackSchedule>({ videoSegments: [], audioSegments: [] });
  scheduleRef.current = schedule;

  const isPlayingRef = useRef<boolean>(false);
  isPlayingRef.current = isPlaying;

  const [meterL, setMeterL] = useState(-60);
  const [meterR, setMeterR] = useState(-60);

  useEffect(() => {
    audioMixerRef.current.setMasterVolume(masterVolume);
    audioMixerRef.current.setMasterMute(isMasterMuted);
  }, [masterVolume, isMasterMuted]);

  useEffect(() => {
    let cancelled = false;
    invoke<PlaybackSchedule>("get_playback_schedule")
      .then((sched) => {
        if (!cancelled) {
          setSchedule(sched);
        }
      })
      .catch((err) => {
        console.error("Failed to get playback schedule from Rust:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [tracks]);

  const totalDuration = useMemo(() => {
    let max = 0;
    const vSegs = schedule.videoSegments;
    const aSegs = schedule.audioSegments;
    if (vSegs.length > 0) max = Math.max(max, vSegs[vSegs.length - 1].timelineEnd);
    if (aSegs.length > 0) max = Math.max(max, aSegs[aSegs.length - 1].timelineEnd);
    return Math.max(max, 10);
  }, [schedule]);

  const getSegmentAt = useCallback((time: number): PlaybackSegment | null => {
    const list = scheduleRef.current.videoSegments;
    for (const seg of list) {
      if (time >= seg.timelineStart && time < seg.timelineEnd) {
        return seg;
      }
    }
    return null;
  }, []);

  const getNextSegmentAfter = useCallback((time: number): PlaybackSegment | null => {
    const list = scheduleRef.current.videoSegments;
    for (const seg of list) {
      if (seg.timelineStart >= time - 0.01) {
        return seg;
      }
    }
    return null;
  }, []);

  // Pre-caching and syncing loop
  useEffect(() => {
    if (!isPlaying) return;

    let animationFrameId: number;
    let lastPerfTime = performance.now();
    let lastMeterTime = 0;

    const playbackLoop = (now: number) => {
      const dt = Math.min(0.1, (now - lastPerfTime) / 1000);
      lastPerfTime = now;

      const currentPlayhead = useEditorStore.getState().playheadPosition;
      const currentOut = useEditorStore.getState().outPoint;
      const currentIn = useEditorStore.getState().inPoint;

      let nextPlayhead = currentPlayhead + dt;

      // 1. Loop Out Check
      if (currentOut !== null && nextPlayhead >= currentOut) {
        nextPlayhead = currentIn || 0;
      }

      const activeSeg = getSegmentAt(nextPlayhead);
      const nextSeg = getNextSegmentAfter(nextPlayhead);
      
      // Lean Decoder Pool: Keep strictly active clip + 1 upcoming clip in memory
      const activeIds = new Set<string>();
      if (activeSeg) activeIds.add(activeSeg.id);
      if (nextSeg) activeIds.add(nextSeg.id);

      // Create only the active and upcoming video elements
      for (const id of activeIds) {
        if (!videoCacheRef.current.has(id)) {
          const seg = activeSeg?.id === id ? activeSeg : nextSeg;
          if (seg) {
            const vid = document.createElement("video");
            vid.src = convertFileSrc(seg.src);
            vid.crossOrigin = "anonymous";
            vid.preload = "auto";
            vid.muted = true;
            vid.playsInline = true;
            // Pre-seek upcoming clip to trimIn so its first frame is decoded & ready
            if (activeSeg?.id !== id) {
              vid.currentTime = seg.trimIn;
            }
            videoCacheRef.current.set(id, vid);
          }
        }
      }

      // Cleanup any other video elements immediately to free hardware decoder streams
      for (const [id, vid] of videoCacheRef.current.entries()) {
        if (!activeIds.has(id)) {
          vid.pause();
          vid.removeAttribute("src");
          vid.load();
          videoCacheRef.current.delete(id);
          const bmp = frameCacheRef.current.get(id);
          if (bmp) bmp.close();
          frameCacheRef.current.delete(id);
        }
      }

      // Draw to canvas
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      
      if (activeSeg) {
        const vid = videoCacheRef.current.get(activeSeg.id);
        if (vid) {
          const expectedTime = activeSeg.trimIn + (nextPlayhead - activeSeg.timelineStart);
          
          if (vid.paused && vid.readyState >= 2) {
             try {
               if (Math.abs(vid.currentTime - expectedTime) > 0.08) {
                 vid.currentTime = expectedTime;
               }
             } catch {}
             vid.play().catch(() => {});
          }
          
          // Smooth hardware clock sync with zero micro-stutter
          if (!vid.paused && vid.readyState >= 2) {
             const mediaElapsed = vid.currentTime - activeSeg.trimIn;
             if (mediaElapsed >= 0 && mediaElapsed <= activeSeg.duration + 0.1) {
                nextPlayhead = activeSeg.timelineStart + mediaElapsed;
             }
          }

          if (canvas && ctx && vid.readyState >= 2) {
             if (canvas.width !== vid.videoWidth || canvas.height !== vid.videoHeight) {
                if (vid.videoWidth > 0 && vid.videoHeight > 0) {
                   canvas.width = vid.videoWidth;
                   canvas.height = vid.videoHeight;
                }
             }
             ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          }
          
          // Seamless cut transition
          if (nextPlayhead >= activeSeg.timelineEnd - 0.02) {
             if (nextSeg && nextSeg.id !== activeSeg.id && Math.abs(nextSeg.timelineStart - activeSeg.timelineEnd) <= 0.08) {
                nextPlayhead = nextSeg.timelineStart;
                const nextVid = videoCacheRef.current.get(nextSeg.id);
                if (nextVid) {
                   nextVid.play().catch(() => {});
                }
             } else if (!nextSeg) {
                setIsPlaying(false);
                nextPlayhead = activeSeg.timelineEnd;
             }
          }
        }
      } else {
        if (canvas && ctx) {
           ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        if (!nextSeg && nextPlayhead > totalDuration) {
           setIsPlaying(false);
           audioMixerRef.current.pauseAll();
           return;
        }
      }

      setPlayheadPosition(nextPlayhead);
      audioMixerRef.current.sync(nextPlayhead, scheduleRef.current.audioSegments, true, false);

      // Throttle VU meter updates to ~15 FPS to eliminate React reconciliation overhead
      if (now - lastMeterTime > 66) {
        lastMeterTime = now;
        const activeVoices = audioMixerRef.current.getActiveVoiceCount();
        if (!isMasterMuted && activeVoices > 0) {
          const base = -16 + Math.min(10, activeVoices * 3) + Math.sin(now / 70) * 8;
          setMeterL(Math.max(-48, Math.min(-1, base + Math.random() * 4)));
          setMeterR(Math.max(-48, Math.min(-1, base + Math.random() * 5)));
        } else {
          setMeterL(-60);
          setMeterR(-60);
        }
      }

      animationFrameId = requestAnimationFrame(playbackLoop);
    };

    animationFrameId = requestAnimationFrame(playbackLoop);
    return () => {
      cancelAnimationFrame(animationFrameId);
      audioMixerRef.current.pauseAll();
    };
  }, [isPlaying, getSegmentAt, getNextSegmentAfter, isMasterMuted, setIsPlaying, setPlayheadPosition, totalDuration]);

  // Scrubbing/seeking when paused
  const isSeekingRef = useRef(false);
  const pendingSeekTargetRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) return;

    audioMixerRef.current.sync(playheadPosition, scheduleRef.current.audioSegments, false, true);

    const activeSeg = getSegmentAt(playheadPosition);
    if (!activeSeg) {
       const canvas = canvasRef.current;
       if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
       return;
    }

    if (!videoCacheRef.current.has(activeSeg.id)) {
       const vid = document.createElement("video");
       vid.src = convertFileSrc(activeSeg.src);
       vid.crossOrigin = "anonymous";
       vid.preload = "auto";
       vid.muted = true;
       vid.playsInline = true;
       videoCacheRef.current.set(activeSeg.id, vid);
    }

    const vid = videoCacheRef.current.get(activeSeg.id);
    if (vid) {
       const targetTime = activeSeg.trimIn + (playheadPosition - activeSeg.timelineStart);
       
       const draw = () => {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (canvas && ctx && vid.readyState >= 2) {
             if (canvas.width !== vid.videoWidth || canvas.height !== vid.videoHeight) {
                if (vid.videoWidth > 0 && vid.videoHeight > 0) {
                   canvas.width = vid.videoWidth;
                   canvas.height = vid.videoHeight;
                }
             }
             ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          }
       };

       // If video is not ready, instantly display cached thumbnail to prevent empty screen
       if (vid.readyState < 2) {
          const bmp = frameCacheRef.current.get(activeSeg.id);
          if (bmp) {
             const canvas = canvasRef.current;
             const ctx = canvas?.getContext("2d");
             if (canvas && ctx) {
                 if (canvas.width !== bmp.width || canvas.height !== bmp.height) {
                    canvas.width = bmp.width;
                    canvas.height = bmp.height;
                 }
                 ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
             }
          }
       }

       if (Math.abs(vid.currentTime - targetTime) > 0.04) {
          if (isSeekingRef.current) {
             pendingSeekTargetRef.current = targetTime;
          } else {
             isSeekingRef.current = true;
             vid.currentTime = targetTime;
             
             const onSeeked = () => {
                if (!frameCacheRef.current.has(activeSeg.id) && vid.readyState >= 2) {
                   createImageBitmap(vid).then(bmp => frameCacheRef.current.set(activeSeg.id, bmp)).catch(() => {});
                }
                draw();
                if (pendingSeekTargetRef.current !== null && Math.abs(vid.currentTime - pendingSeekTargetRef.current) > 0.04) {
                   vid.currentTime = pendingSeekTargetRef.current;
                   pendingSeekTargetRef.current = null;
                } else {
                   isSeekingRef.current = false;
                   vid.removeEventListener("seeked", onSeeked);
                }
             };
             vid.addEventListener("seeked", onSeeked);
          }
       } else if (vid.readyState >= 2) {
          draw();
       }
    }
  }, [playheadPosition, isPlaying, getSegmentAt]);

  // Rapid Play/Pause hook
  const resumeAudio = useCallback(() => {
     audioMixerRef.current.ensureContext();
  }, []);

  useEffect(() => {
    if (!isPlaying) {
       audioMixerRef.current.pauseAll();
       videoCacheRef.current.forEach(vid => vid.pause());
       setMeterL(-60);
       setMeterR(-60);
    } else {
       audioMixerRef.current.sync(playheadPosition, scheduleRef.current.audioSegments, true, true);
       const activeSeg = getSegmentAt(playheadPosition);
       if (activeSeg) {
          const vid = videoCacheRef.current.get(activeSeg.id);
          if (vid) vid.play().catch(() => {});
       }
    }
  }, [isPlaying]);

  return {
    canvasRef,
    hasMedia: schedule.videoSegments.length > 0 || schedule.audioSegments.length > 0,
    totalDuration,
    meterL,
    meterR,
    playheadPosition,
    isPlaying,
    setIsPlaying,
    resumeAudio,
    inPoint,
    outPoint,
    setPlayheadPosition,
  };
}


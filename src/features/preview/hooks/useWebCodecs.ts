import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../../../stores/useEditorStore";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import * as MP4Box from "mp4box";
import { MP4ArrayBuffer, MP4BoxFile, MP4Info, MP4Sample } from "mp4box";
import { renderBlackFrame, renderVideoFrame } from "../utils/canvasRenderer";
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
}

export interface PlaybackSchedule {
  videoSegments: PlaybackSegment[];
  audioSegments: PlaybackSegment[];
}

interface DecoderContext {
  decoder: VideoDecoder;
  config: VideoDecoderConfig | null;
  mp4boxfile: MP4BoxFile;
  samples: MP4Sample[];
  demuxReady: boolean;
  feederState: {
    nextSampleIdx: number;
    lastTargetIdx: number;
  };
  frameQueue: VideoFrame[];
}

export function useWebCodecs() {
  const playheadPosition = useEditorStore((state) => state.playheadPosition);
  const setPlayheadPosition = useEditorStore((state) => state.setPlayheadPosition);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const tracks = useEditorStore((state) => state.tracks);
  const masterVolume = useEditorStore((state) => state.masterVolume);
  const isMasterMuted = useEditorStore((state) => state.isMasterMuted);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioMixerRef = useRef<MultiTrackAudioMixer>(new MultiTrackAudioMixer());

  const [schedule, setSchedule] = useState<PlaybackSchedule>({ videoSegments: [], audioSegments: [] });
  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;

  // Multi-clip context map
  const contextsRef = useRef<Map<string, DecoderContext>>(new Map());

  const [hasMedia, setHasMedia] = useState(false);
  const totalDuration = 100; // Mock duration

  // Audio volume & mute sync
  useEffect(() => {
    audioMixerRef.current.setMasterVolume(masterVolume);
    audioMixerRef.current.setMasterMute(isMasterMuted);
  }, [masterVolume, isMasterMuted]);

  // Audio paused-state position sync (only triggered when playhead moves while paused, not in high-frequency RAF)
  useEffect(() => {
    if (!isPlaying) {
      audioMixerRef.current.sync(
        playheadPosition,
        schedule.audioSegments,
        false,
        true
      );
    }
  }, [playheadPosition, isPlaying, schedule.audioSegments]);

  // Fetch schedule from Rust
  useEffect(() => {
    invoke<PlaybackSchedule>("get_playback_schedule")
      .then((sched) => {
        setSchedule(sched);
        setHasMedia(sched.videoSegments.length > 0 || sched.audioSegments.length > 0);
      })
      .catch((err) => console.error("Failed to get playback schedule:", err));
  }, [tracks]);

  // Demux MP4s into memory
  useEffect(() => {
    if (schedule.videoSegments.length === 0) return;

    const uniqueSrcs = Array.from(new Set(schedule.videoSegments.map((s) => s.src)));
    let isCancelled = false;

    uniqueSrcs.forEach((src) => {
      if (contextsRef.current.has(src)) return; // Already loaded or loading

      const srcUrl = convertFileSrc(src);

      const ctx: DecoderContext = {
        decoder: null as unknown as VideoDecoder,
        config: null,
        mp4boxfile: null as unknown as MP4BoxFile,
        samples: [],
        demuxReady: false,
        feederState: {
          nextSampleIdx: 0,
          lastTargetIdx: -1,
        },
        frameQueue: [],
      };

      contextsRef.current.set(src, ctx);

      // Initialize WebCodecs VideoDecoder
      const decoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
          if (isCancelled) {
            frame.close();
            return;
          }
          ctx.frameQueue.push(frame);
        },
        error: (e: Error | DOMException) => console.error(`Decoder Error (${src}):`, e.message),
      });
      ctx.decoder = decoder;

      // Initialize MP4Box
      const mp4boxfile = MP4Box.createFile();
      ctx.mp4boxfile = mp4boxfile;

      mp4boxfile.onReady = (info: MP4Info) => {
        if (isCancelled) return;
        const videoTrack = info.videoTracks[0];
        if (!videoTrack) return;

        const codec = videoTrack.codec.startsWith("avc1") ? videoTrack.codec : "avc1.42E01E";

        let description: Uint8Array | undefined;
        const trak = mp4boxfile.getTrackById(videoTrack.id);
        if (trak) {
          for (const entry of trak.mdia.minf.stbl.stsd.entries) {
            if (entry.avcC || entry.hvcC || entry.vpcC || entry.av1C) {
              const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
              if (entry.avcC) entry.avcC.write(stream);
              else if (entry.hvcC) entry.hvcC.write(stream);
              else if (entry.vpcC) entry.vpcC.write(stream);
              else if (entry.av1C) entry.av1C.write(stream);
              description = new Uint8Array(stream.buffer, 8); // Skip box header
              break;
            }
          }
        }

        const config: VideoDecoderConfig = {
          codec,
          codedWidth: videoTrack.video.width,
          codedHeight: videoTrack.video.height,
          description,
          hardwareAcceleration: "prefer-hardware",
        };
        ctx.config = config;
        decoder.configure(config);

        mp4boxfile.setExtractionOptions(videoTrack.id, null, { nbSamples: 10000 });
        mp4boxfile.start();
      };

      mp4boxfile.onSamples = (_id: number, _user: unknown, samples: MP4Sample[]) => {
        if (isCancelled) return;
        ctx.samples.push(...samples);
      };

      // Fetch MP4
      fetch(srcUrl)
        .then(async (response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const reader = response.body?.getReader();
          if (!reader) throw new Error("No reader");

          let offset = 0;
          while (!isCancelled) {
            const { done, value } = await reader.read();
            if (done) {
              mp4boxfile.flush();
              ctx.demuxReady = true;
              break;
            }
            if (value) {
              const buffer = value.buffer as MP4ArrayBuffer;
              buffer.fileStart = offset;
              mp4boxfile.appendBuffer(buffer);
              offset += value.length;
            }
          }
        })
        .catch((e: Error) => console.error(`Fetch Error (${src}):`, e.message));
    });

    return () => {
      isCancelled = true;
      contextsRef.current.forEach((ctx) => {
        ctx.mp4boxfile.stop();
        if (ctx.decoder && ctx.decoder.state !== "closed") {
          ctx.decoder.close();
        }
        ctx.frameQueue.forEach((f) => f.close());
        ctx.frameQueue = [];
      });
      contextsRef.current.clear();
      audioMixerRef.current.stopAll();
    };
  }, [schedule]);

  // Master Render & Sync Loop (Instant Synchronous Scrubbing + Smooth Playback)
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const currentPlayhead = useEditorStore.getState().playheadPosition;
      const isPlayingNow = useEditorStore.getState().isPlaying;

      // 1. Playback Advancement
      if (isPlayingNow) {
        const dt = (now - lastTime) / 1000;
        useEditorStore.getState().setPlayheadPosition(currentPlayhead + dt);

        // Sync Audio continuously only while playing
        audioMixerRef.current.sync(
          currentPlayhead,
          scheduleRef.current.audioSegments,
          true
        );
      }
      lastTime = now;

      // Find the active segment under the playhead
      const activeSeg = scheduleRef.current.videoSegments.find(
        (s) => currentPlayhead >= s.timelineStart && currentPlayhead < s.timelineEnd
      );

      // If playhead is over an empty gap or outside any clip, render solid black!
      if (!activeSeg) {
        renderBlackFrame(canvasRef.current);
        animId = requestAnimationFrame(loop);
        return;
      }

      const ctx = contextsRef.current.get(activeSeg.src);
      if (!ctx || !ctx.demuxReady || ctx.samples.length === 0) {
        renderBlackFrame(canvasRef.current);
        animId = requestAnimationFrame(loop);
        return;
      }

      const localTime = activeSeg.trimIn + (currentPlayhead - activeSeg.timelineStart);

      // Find the target sample for localTime (fallback to last sample if past all CTS)
      const samples = ctx.samples;
      let targetIdx = samples.length - 1;
      for (let i = 0; i < samples.length; i++) {
        if (samples[i].cts / samples[i].timescale >= localTime) {
          targetIdx = i;
          break;
        }
      }

      // 2. Synchronous Instant Scrub Seeking
      if (!isPlayingNow) {
        // If scrubbing backward past our fed position, or jumped far forward (> 30 samples)
        const isBackwardSeek = targetIdx < ctx.feederState.nextSampleIdx - 1;
        const isFarForwardJump = targetIdx > ctx.feederState.nextSampleIdx + 30;

        if (isBackwardSeek || isFarForwardJump) {
          // Instant synchronous reset without blocking Promise flushes!
          try {
            ctx.decoder.reset();
            if (ctx.config) {
              ctx.decoder.configure(ctx.config);
            }
          } catch (e) {
            console.error("Decoder reset error:", e);
          }

          // Clear existing queued frames
          ctx.frameQueue.forEach((f) => f.close());
          ctx.frameQueue = [];

          // Find preceding Keyframe
          let keyIdx = 0;
          for (let i = 0; i <= targetIdx && i < samples.length; i++) {
            if (samples[i].is_sync) keyIdx = i;
          }
          ctx.feederState.nextSampleIdx = keyIdx;
        }
      }

      // 3. DPB Feeding Logic
      if (ctx.decoder.state === "configured") {
        const dec = ctx.decoder;

        // When playing: feed until 15 frames ahead
        // When scrubbing: feed ONLY up to targetIdx + 1 so we don't do useless future decodes
        const maxSampleIdx = isPlayingNow ? samples.length : Math.min(samples.length, targetIdx + 1);

        while (
          dec.decodeQueueSize < 8 &&
          (isPlayingNow ? ctx.frameQueue.length < 15 : true) &&
          ctx.feederState.nextSampleIdx < maxSampleIdx
        ) {
          const sample = samples[ctx.feederState.nextSampleIdx];
          const chunk = new EncodedVideoChunk({
            type: sample.is_sync ? "key" : "delta",
            timestamp: (sample.cts * 1000000) / sample.timescale,
            duration: (sample.duration * 1000000) / sample.timescale,
            data: sample.data,
          });
          try {
            dec.decode(chunk);
          } catch (e) {
            console.error("Decode error:", e);
          }
          ctx.feederState.nextSampleIdx++;
        }
      }

      // 4. DPB Renderer Logic
      if (ctx.frameQueue.length > 0) {
        // Sort frames by presentation timestamp
        ctx.frameQueue.sort((a, b) => a.timestamp - b.timestamp);

        let frameToDraw: VideoFrame | null = null;
        const framesToDrop: VideoFrame[] = [];

        for (let i = 0; i < ctx.frameQueue.length; i++) {
          const f = ctx.frameQueue[i];
          const fTime = f.timestamp / 1000000;

          // When scrubbing: drop intermediate catch-up frames without drawing
          if (!isPlayingNow && fTime < localTime - 0.04) {
            framesToDrop.push(f);
            continue;
          }

          if (fTime <= localTime + 0.05) {
            if (frameToDraw) framesToDrop.push(frameToDraw);
            frameToDraw = f;
          } else {
            break; // Frame is in the future
          }
        }

        if (frameToDraw) {
          renderVideoFrame(canvasRef.current, frameToDraw);

          framesToDrop.forEach((f) => f.close());
          ctx.frameQueue = ctx.frameQueue.filter((f) => f !== frameToDraw && !framesToDrop.includes(f));
          frameToDraw.close();
        } else if (framesToDrop.length > 0) {
          framesToDrop.forEach((f) => f.close());
          ctx.frameQueue = ctx.frameQueue.filter((f) => !framesToDrop.includes(f));
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  return {
    canvasRef,
    hasMedia,
    totalDuration,
    meterL: -60,
    meterR: -60,
    playheadPosition,
    isPlaying,
    setIsPlaying,
    resumeAudio: () => {
      audioMixerRef.current.ensureContext();
    },
    inPoint: null,
    outPoint: null,
    setPlayheadPosition,
  };
}

import { convertFileSrc } from "@tauri-apps/api/core";
import { PlaybackSegment } from "../hooks/useWebCodecs";

interface ActiveAudioVoice {
  id: string; // segment id
  src: string;
  audio: HTMLAudioElement;
  sourceNode: MediaElementAudioSourceNode | null;
  gainNode: GainNode | null;
  isReady: boolean;
}

export class MultiTrackAudioMixer {
  private voices: Map<string, ActiveAudioVoice> = new Map(); // key: segment id
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterVolume: number = 1;
  private isMuted: boolean = false;
  private activeSegments: Set<string> = new Set();

  public ensureContext() {
    if (!this.audioCtx) {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;
        this.audioCtx = new AudioContextClass();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.connect(this.audioCtx.destination);
        this.updateVolumes();
      } catch (e) {
        console.warn("AudioContext initialization fallback:", e);
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
  }

  public setMasterVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    this.updateVolumes();
  }

  public setMasterMute(muted: boolean) {
    this.isMuted = muted;
    this.updateVolumes();
  }

  private updateVolumes() {
    const effectiveVolume = this.isMuted ? 0 : this.masterVolume;

    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(effectiveVolume, this.audioCtx.currentTime);
    }

    // Direct audio element fallback volume
    for (const voice of this.voices.values()) {
      voice.audio.volume = effectiveVolume;
      voice.audio.muted = this.isMuted;
    }
  }

  public sync(
    playheadPosition: number,
    audioSegments: PlaybackSegment[],
    isPlaying: boolean,
    forceSeek: boolean = false
  ) {
    this.ensureContext();
    this.activeSegments.clear();

    for (const seg of audioSegments) {
      if (playheadPosition >= seg.timelineStart && playheadPosition < seg.timelineEnd) {
        this.activeSegments.add(seg.id);

        let voice = this.voices.get(seg.id);
        const expectedMediaTime = Math.max(0, seg.trimIn + (playheadPosition - seg.timelineStart));

        if (!voice) {
          const audio = new Audio();
          audio.src = convertFileSrc(seg.src);
          audio.preload = "auto";
          audio.volume = this.isMuted ? 0 : this.masterVolume;
          audio.muted = this.isMuted;

          let sourceNode: MediaElementAudioSourceNode | null = null;
          let gainNode: GainNode | null = null;

          if (this.audioCtx && this.masterGain) {
            try {
              sourceNode = this.audioCtx.createMediaElementSource(audio);
              gainNode = this.audioCtx.createGain();
              sourceNode.connect(gainNode);
              gainNode.connect(this.masterGain);
            } catch (e) {
              console.warn("WebAudio node connection fallback:", e);
            }
          }

          voice = {
            id: seg.id,
            src: seg.src,
            audio,
            sourceNode,
            gainNode,
            isReady: false,
          };

          const onReady = () => {
            if (!voice) return;
            voice.isReady = true;
            try {
              voice.audio.currentTime = expectedMediaTime;
            } catch {}
            if (isPlaying) {
              if (voice.gainNode && this.audioCtx) {
                voice.gainNode.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
                voice.gainNode.gain.linearRampToValueAtTime(1.0, this.audioCtx.currentTime + 0.008);
              }
              voice.audio.play().catch((err) => console.warn("Audio play blocked:", err));
            }
          };

          if (audio.readyState >= 1) {
            onReady();
          } else {
            audio.addEventListener("loadedmetadata", onReady, { once: true });
          }

          this.voices.set(seg.id, voice);
        } else {
          // Voice exists
          if (isPlaying) {
            if (forceSeek && voice.isReady) {
              try {
                voice.audio.currentTime = expectedMediaTime;
              } catch {}
            }
            if (voice.isReady && voice.audio.paused) {
              try {
                if (Math.abs(voice.audio.currentTime - expectedMediaTime) > 0.08) {
                  voice.audio.currentTime = expectedMediaTime;
                }
              } catch {}
              if (voice.gainNode && this.audioCtx) {
                voice.gainNode.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
                voice.gainNode.gain.linearRampToValueAtTime(1.0, this.audioCtx.currentTime + 0.008);
              }
              voice.audio.play().catch(() => {});
            } else if (voice.isReady && !voice.audio.paused) {
              // Drift correction during playback
              if (Math.abs(voice.audio.currentTime - expectedMediaTime) > 0.15) {
                try {
                  voice.audio.currentTime = expectedMediaTime;
                } catch {}
              }
            }
          } else {
            // Paused state
            if (!voice.audio.paused) {
              voice.audio.pause();
            }
            if (forceSeek && voice.isReady) {
              try {
                voice.audio.currentTime = expectedMediaTime;
              } catch {}
            }
          }
        }
      }
    }

    // Pause inactive segments
    for (const [id, voice] of this.voices.entries()) {
      if (!this.activeSegments.has(id)) {
        if (!voice.audio.paused) {
          voice.audio.pause();
        }
      }
    }

    // LRU Voice cleanup (keep up to 16 voices cached)
    if (this.voices.size > 16) {
      for (const [id, voice] of this.voices.entries()) {
        if (!this.activeSegments.has(id)) {
          voice.audio.pause();
          voice.audio.removeAttribute("src");
          voice.audio.load();
          if (voice.gainNode) voice.gainNode.disconnect();
          if (voice.sourceNode) voice.sourceNode.disconnect();
          this.voices.delete(id);
          if (this.voices.size <= 16) break;
        }
      }
    }
  }

  public pauseAll() {
    this.voices.forEach((voice) => {
      if (!voice.audio.paused) {
        voice.audio.pause();
      }
    });
  }

  public playAll() {
    this.ensureContext();
    this.voices.forEach((voice) => {
      if (voice.audio.paused && voice.isReady && this.activeSegments.has(voice.id)) {
        voice.audio.play().catch(() => {});
      }
    });
  }

  public stopAll() {
    this.voices.forEach((voice) => {
      voice.audio.pause();
      voice.audio.removeAttribute("src");
      voice.audio.load();
      if (voice.gainNode) voice.gainNode.disconnect();
      if (voice.sourceNode) voice.sourceNode.disconnect();
    });
    this.voices.clear();
    this.activeSegments.clear();
  }

  public getActiveVoiceCount(): number {
    return this.activeSegments.size;
  }
}

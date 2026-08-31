import { convertFileSrc } from "@tauri-apps/api/core";
import { Track } from "../../../types/editor";

interface ActiveAudioVoice {
  trackId: string;
  clipId: string;
  src: string;
  audio: HTMLAudioElement;
  isReady: boolean;
  targetStartOffset: number;
}

export class MultiTrackAudioMixer {
  private voices: Map<string, ActiveAudioVoice> = new Map(); // key: trackId
  private masterVolume: number = 1;
  private isMuted: boolean = false;

  public setMasterVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    this.updateVolumes();
  }

  public setMasterMute(muted: boolean) {
    this.isMuted = muted;
    this.updateVolumes();
  }

  private updateVolumes() {
    const effectiveVol = this.isMuted ? 0 : this.masterVolume;
    this.voices.forEach((voice) => {
      voice.audio.volume = effectiveVol;
      voice.audio.muted = this.isMuted;
    });
  }

  /**
   * Sync all audio tracks to the current playhead position.
   * Plays multiple overlapping audio tracks concurrently (A1, A2, etc.).
   */
  public sync(playheadPosition: number, tracks: Track[], isPlaying: boolean) {
    const audioTracks = tracks.filter((t) => t.type === "audio" && !t.isMuted);
    const activeTrackIds = new Set<string>();

    for (const track of audioTracks) {
      // Find clip active at current playhead
      const activeClip = track.items.find(
        (item) =>
          item.src &&
          playheadPosition >= (item.start || 0) &&
          playheadPosition < (item.start || 0) + (item.duration || 0)
      );

      if (!activeClip || !activeClip.src) {
        // No active clip on this track: clean up voice
        const existing = this.voices.get(track.id);
        if (existing) {
          existing.audio.pause();
          existing.audio.src = "";
          this.voices.delete(track.id);
        }
        continue;
      }

      activeTrackIds.add(track.id);
      const expectedMediaTime = Math.max(
        0,
        (activeClip.trimIn || 0) + (playheadPosition - (activeClip.start || 0))
      );

      let voice = this.voices.get(track.id);

      // New voice or changed clip
      if (!voice || voice.clipId !== activeClip.id) {
        if (voice) {
          voice.audio.pause();
          voice.audio.src = "";
        }

        const audio = new Audio();
        audio.src = convertFileSrc(activeClip.src);
        audio.preload = "auto";
        audio.volume = this.isMuted ? 0 : this.masterVolume;
        audio.muted = this.isMuted;

        const newVoice: ActiveAudioVoice = {
          trackId: track.id,
          clipId: activeClip.id,
          src: activeClip.src,
          audio,
          isReady: false,
          targetStartOffset: expectedMediaTime,
        };

        const onReady = () => {
          newVoice.isReady = true;
          try {
            audio.currentTime = expectedMediaTime;
          } catch {}
          if (isPlaying) {
            audio.play().catch(() => {});
          }
        };

        if (audio.readyState >= 1) {
          onReady();
        } else {
          audio.addEventListener("loadedmetadata", onReady, { once: true });
        }

        this.voices.set(track.id, newVoice);
      } else {
        // Voice exists: manage playback state
        if (isPlaying) {
          if (voice.isReady && voice.audio.paused) {
            voice.audio.play().catch(() => {});
          }
          // Only perform drift correction if significant drift (> 250ms) and audio is playing smoothly
          if (voice.isReady && voice.audio.readyState >= 2) {
            const drift = Math.abs(voice.audio.currentTime - expectedMediaTime);
            if (drift > 0.25) {
              voice.audio.currentTime = expectedMediaTime;
            }
          }
        } else {
          // Paused: pause audio and seek to exact frame
          if (!voice.audio.paused) {
            voice.audio.pause();
          }
          if (voice.isReady && Math.abs(voice.audio.currentTime - expectedMediaTime) > 0.04) {
            voice.audio.currentTime = expectedMediaTime;
          }
        }
      }
    }

    // Clean up voices for tracks that are no longer active
    this.voices.forEach((voice, trackId) => {
      if (!activeTrackIds.has(trackId)) {
        voice.audio.pause();
        voice.audio.src = "";
        this.voices.delete(trackId);
      }
    });
  }

  public pauseAll() {
    this.voices.forEach((voice) => {
      if (!voice.audio.paused) {
        voice.audio.pause();
      }
    });
  }

  public playAll() {
    this.voices.forEach((voice) => {
      if (voice.audio.paused) {
        voice.audio.play().catch(() => {});
      }
    });
  }

  public stopAll() {
    this.voices.forEach((voice) => {
      voice.audio.pause();
      voice.audio.src = "";
    });
    this.voices.clear();
  }

  public getActiveVoiceCount(): number {
    return this.voices.size;
  }
}

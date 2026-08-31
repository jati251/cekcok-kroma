import { convertFileSrc } from "@tauri-apps/api/core";
import { Track } from "../../../types/editor";

interface ActiveAudioVoice {
  trackId: string;
  clipId: string;
  src: string;
  audio: HTMLAudioElement;
  targetTime: number;
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
    const vol = this.isMuted ? 0 : this.masterVolume;
    this.voices.forEach((voice) => {
      voice.audio.volume = vol;
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
        // No clip active on this track; pause and remove voice if present
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

      // If voice doesn't exist or clip changed, create/re-target voice
      if (!voice || voice.clipId !== activeClip.id) {
        if (voice) {
          voice.audio.pause();
        }

        const audio = new Audio();
        audio.src = convertFileSrc(activeClip.src);
        audio.preload = "auto";
        audio.volume = this.isMuted ? 0 : this.masterVolume;
        audio.muted = this.isMuted;
        audio.currentTime = expectedMediaTime;

        voice = {
          trackId: track.id,
          clipId: activeClip.id,
          src: activeClip.src,
          audio,
          targetTime: expectedMediaTime,
        };
        this.voices.set(track.id, voice);

        if (isPlaying) {
          voice.audio.play().catch(() => {});
        }
      } else {
        // Voice already exists for this clip
        if (isPlaying) {
          if (voice.audio.paused) {
            voice.audio.play().catch(() => {});
          }
          // Only perform drift correction if audio drifted more than 150ms
          const drift = Math.abs(voice.audio.currentTime - expectedMediaTime);
          if (drift > 0.18) {
            voice.audio.currentTime = expectedMediaTime;
          }
        } else {
          // Paused: pause audio and seek to exact position
          if (!voice.audio.paused) {
            voice.audio.pause();
          }
          if (Math.abs(voice.audio.currentTime - expectedMediaTime) > 0.04) {
            voice.audio.currentTime = expectedMediaTime;
          }
        }
      }
    }

    // Clean up voices for tracks that are now muted or have no clip
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

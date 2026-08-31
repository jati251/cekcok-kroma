import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { DragItem } from "../../../types/editor";

interface RustVideoMetadata {
  duration: number;
  width: number;
  height: number;
  has_audio: boolean;
}

export async function importMediaFile(): Promise<DragItem | null> {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Video",
          extensions: ["mp4", "mov", "webm"],
        },
      ],
    });

    if (typeof selected !== "string") {
      return null;
    }

    let duration = 10;
    let width = 1920;
    let height = 1080;
    let hasAudio = true;
    let waveform: number[] = [];

    // Call Rust backend for metadata
    try {
      const metadata = await invoke<RustVideoMetadata>("get_video_metadata", {
        path: selected,
      });
      if (metadata) {
        duration = metadata.duration || 10;
        width = metadata.width || 1920;
        height = metadata.height || 1080;
        hasAudio = metadata.has_audio;
      }
    } catch (error) {
      console.warn("FFprobe metadata fallback:", error);
    }

    // Call Rust backend to extract audio waveform peaks
    if (hasAudio) {
      try {
        const wf = await invoke<number[]>("get_audio_waveform", {
          path: selected,
          points: 120,
        });
        if (wf && wf.length > 0) {
          waveform = wf;
        }
      } catch (err) {
        console.warn("Waveform extraction fallback:", err);
      }
    }

    const fileName = selected.split("/").pop() || selected.split("\\").pop() || "Video";

    return {
      id: `media-${Date.now()}`,
      type: "media",
      name: fileName,
      color: "#2d8ceb",
      src: selected,
      duration,
      width,
      height,
      hasAudio,
      waveform,
    };
  } catch (err) {
    console.error("Failed to import media file:", err);
    return null;
  }
}

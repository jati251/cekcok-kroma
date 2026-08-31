import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { DragItem } from "../../../types/editor";

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
    try {
      const metadata: { duration: number } = await invoke("get_video_metadata", {
        path: selected,
      });
      if (metadata && typeof metadata.duration === "number") {
        duration = metadata.duration;
      }
    } catch (error) {
      console.warn("FFprobe metadata fallback:", error);
    }

    const fileName = selected.split("/").pop() || selected.split("\\").pop() || "Video";

    return {
      id: `media-${Date.now()}`,
      type: "media",
      name: fileName,
      color: "#3b82f6",
      src: selected,
      duration,
    };
  } catch (err) {
    console.error("Failed to import media file:", err);
    return null;
  }
}

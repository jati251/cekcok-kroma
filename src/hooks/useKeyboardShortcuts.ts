import { useEffect } from "react";
import { useEditorStore } from "../stores/useEditorStore";
import { listen } from "@tauri-apps/api/event";
import { importMediaFile } from "../features/media-bin";

/**
 * Global Keyboard Shortcut & Native OS Menu Action Hook
 */
export function useKeyboardShortcuts() {
  const setActiveTool = useEditorStore((state) => state.setActiveTool);
  const deleteSelectedClip = useEditorStore((state) => state.deleteSelectedClip);
  const stepFrame = useEditorStore((state) => state.stepFrame);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const setZoomLevel = useEditorStore((state) => state.setZoomLevel);
  const setInPoint = useEditorStore((state) => state.setInPoint);
  const setOutPoint = useEditorStore((state) => state.setOutPoint);
  const addMediaItem = useEditorStore((state) => state.addMediaItem);

  // Native OS Application Menu Event Listener (macOS titlebar / Windows menu bar)
  useEffect(() => {
    const unlistenPromise = listen<string>("native-menu-action", async (event) => {
      const action = event.payload;
      const playhead = useEditorStore.getState().playheadPosition;

      switch (action) {
        case "import_media": {
          const media = await importMediaFile();
          if (media) addMediaItem(media);
          break;
        }
        case "delete_clip":
          deleteSelectedClip();
          break;
        case "play_pause":
          setIsPlaying(!useEditorStore.getState().isPlaying);
          break;
        case "razor_cut":
          setActiveTool("razor");
          break;
        case "mark_in":
          setInPoint(playhead);
          break;
        case "mark_out":
          setOutPoint(playhead);
          break;
        case "about_app":
          alert("Cekcok Kroma v1.3.0\nProfessional Rust-first NLE Video Editor\nEngine: Tauri v2 + FFmpeg");
          break;
        default:
          break;
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [deleteSelectedClip, setIsPlaying, setActiveTool, setInPoint, setOutPoint, addMediaItem]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger shortcuts when typing inside form inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "v":
          setActiveTool("selection");
          break;

        case "c":
          setActiveTool("razor");
          break;

        case "h":
          setActiveTool("hand");
          break;

        case " ":
          e.preventDefault();
          setIsPlaying(!useEditorStore.getState().isPlaying);
          break;

        case "arrowleft":
          e.preventDefault();
          stepFrame(-1);
          break;

        case "arrowright":
          e.preventDefault();
          stepFrame(1);
          break;

        case "backspace":
        case "delete":
          deleteSelectedClip();
          break;

        case "=":
        case "+":
          setZoomLevel(useEditorStore.getState().zoomLevel + 10);
          break;

        case "-":
          setZoomLevel(useEditorStore.getState().zoomLevel - 10);
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setActiveTool, deleteSelectedClip, stepFrame, setIsPlaying, setZoomLevel]);
}

import { useEffect } from "react";
import { useEditorStore } from "../stores/useEditorStore";

/**
 * Global Keyboard Shortcut Hook for NLE controls
 */
export function useKeyboardShortcuts() {
  const setActiveTool = useEditorStore(state => state.setActiveTool);
  const deleteSelectedClip = useEditorStore(state => state.deleteSelectedClip);
  const stepFrame = useEditorStore(state => state.stepFrame);
  const setIsPlaying = useEditorStore(state => state.setIsPlaying);
  const setZoomLevel = useEditorStore(state => state.setZoomLevel);

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

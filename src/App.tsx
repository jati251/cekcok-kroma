import { useEffect } from "react";
import { MediaBin } from "./features/media-bin/MediaBin";
import { ProgramMonitor } from "./features/preview/ProgramMonitor";
import { Timeline } from "./features/timeline/Timeline";
import { Toolbar } from "./features/toolbar/Toolbar";
import { Inspector } from "./features/inspector/Inspector";
import { DragGhost } from "./components/DragGhost";
import { useEditorStore } from "./stores/useEditorStore";

function App() {
  const setActiveTool = useEditorStore(state => state.setActiveTool);
  const setIsPlaying = useEditorStore(state => state.setIsPlaying);
  const deleteSelectedClip = useEditorStore(state => state.deleteSelectedClip);
  const setZoomLevel = useEditorStore(state => state.setZoomLevel);
  const draggedItem = useEditorStore(state => state.draggedItem);
  const setDraggedItem = useEditorStore(state => state.setDraggedItem);
  const setDragCursor = useEditorStore(state => state.setDragCursor);
  const stepFrame = useEditorStore(state => state.stepFrame);

  // Global Pointer Tracker for Media Bin Dragging
  useEffect(() => {
    if (!draggedItem) return;

    const handlePointerMove = (e: PointerEvent) => {
      setDragCursor({ x: e.clientX, y: e.clientY });
    };

    const handlePointerUp = () => {
      // Delay slightly so track onPointerUp can read draggedItem first
      setTimeout(() => {
        setDraggedItem(null);
        setDragCursor(null);
      }, 50);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggedItem, setDragCursor, setDraggedItem]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field (like Inspector)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch(e.key.toLowerCase()) {
        case 'v':
          setActiveTool('selection');
          break;
        case 'c':
          setActiveTool('razor');
          break;
        case 'h':
          setActiveTool('hand');
          break;
        case ' ':
          e.preventDefault(); // prevent scrolling
          setIsPlaying(!useEditorStore.getState().isPlaying);
          break;
        case 'arrowleft':
          e.preventDefault();
          stepFrame(-1);
          break;
        case 'arrowright':
          e.preventDefault();
          stepFrame(1);
          break;
        case 'backspace':
        case 'delete':
          deleteSelectedClip();
          break;
        case '=':
        case '+':
          setZoomLevel(useEditorStore.getState().zoomLevel + 10);
          break;
        case '-':
          setZoomLevel(useEditorStore.getState().zoomLevel - 10);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTool, deleteSelectedClip, setIsPlaying, setZoomLevel, stepFrame]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground text-[11px] font-sans">


      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden p-0.5 gap-0.5 bg-[#141414]">
        <div className="flex flex-col w-[300px] gap-0.5">
          <MediaBin />
          <Inspector />
        </div>
        <ProgramMonitor />
      </div>

      {/* Timeline Area */}
      <div className="h-[45%] flex gap-0.5 bg-[#141414] p-0.5 pt-0">
        <Toolbar />
        <Timeline />
      </div>

      {/* Floating Drag Preview that follows cursor */}
      <DragGhost />
    </div>
  );
}

export default App;

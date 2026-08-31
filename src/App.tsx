import { useEffect } from "react";
import { MediaBin } from "./features/media-bin/MediaBin";
import { ProgramMonitor } from "./features/preview/ProgramMonitor";
import { Timeline } from "./features/timeline/Timeline";
import { Toolbar } from "./features/toolbar/Toolbar";
import { Inspector } from "./features/inspector/Inspector";
import { useEditorStore } from "./stores/useEditorStore";

function App() {
  const setActiveTool = useEditorStore(state => state.setActiveTool);
  const setIsPlaying = useEditorStore(state => state.setIsPlaying);
  const deleteSelectedClip = useEditorStore(state => state.deleteSelectedClip);
  const setZoomLevel = useEditorStore(state => state.setZoomLevel);

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
          // Using store directly to avoid stale closures in event listener
          setIsPlaying(!useEditorStore.getState().isPlaying);
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
  }, [setActiveTool, deleteSelectedClip]);

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
    </div>
  );
}

export default App;

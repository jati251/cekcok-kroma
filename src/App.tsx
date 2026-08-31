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
  }, [setActiveTool, setIsPlaying, deleteSelectedClip, setZoomLevel]);

  // NOTE: Playback Loop has been moved to ProgramMonitor.tsx
  // This is because the best way to get zero lag is to let the <video> play natively
  // and sync the playhead to its currentTime, rather than manually advancing the playhead via RequestAnimationFrame here.

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground text-[11px] font-sans selection:bg-accent/30">
      {/* Header (Mac OS Overlay style) */}
      <header 
        data-tauri-drag-region 
        className="flex items-center justify-between px-2 pl-[72px] h-7 border-b border-[var(--panel-border)] bg-[var(--panel-bg)] shrink-0 select-none"
      >
        <div className="flex items-center gap-3 pointer-events-none">
          <div className="w-3 h-3 bg-[#c975ff] rounded-sm ml-1" />
          <div className="flex gap-3 text-[#cccccc] text-[11px] pointer-events-auto">
            <button className="hover:bg-[#444] px-1.5 py-0.5 rounded cursor-default">File</button>
            <button className="hover:bg-[#444] px-1.5 py-0.5 rounded cursor-default">Edit</button>
            <button className="hover:bg-[#444] px-1.5 py-0.5 rounded cursor-default">Clip</button>
            <button className="hover:bg-[#444] px-1.5 py-0.5 rounded cursor-default">Sequence</button>
            <button className="hover:bg-[#444] px-1.5 py-0.5 rounded cursor-default">Markers</button>
            <button className="hover:bg-[#444] px-1.5 py-0.5 rounded cursor-default">Graphics</button>
            <button className="hover:bg-[#444] px-1.5 py-0.5 rounded cursor-default">View</button>
            <button className="hover:bg-[#444] px-1.5 py-0.5 rounded cursor-default">Window</button>
            <button className="hover:bg-[#444] px-1.5 py-0.5 rounded cursor-default">Help</button>
          </div>
        </div>
      </header>

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

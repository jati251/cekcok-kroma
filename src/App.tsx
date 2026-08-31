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
  const isPlaying = useEditorStore(state => state.isPlaying);

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

  // Playback Loop
  useEffect(() => {
    if (!isPlaying) return;

    let lastTime = performance.now();
    let animationFrameId: number;

    const loop = (time: number) => {
      if (!useEditorStore.getState().isPlaying) return; // double check

      const delta = (time - lastTime) / 1000; // convert to seconds
      lastTime = time;

      const currentPlayhead = useEditorStore.getState().playheadPosition;
      useEditorStore.getState().setPlayheadPosition(currentPlayhead + delta);

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying]); // Re-run effect when isPlaying changes

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-primary">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-accent rounded-sm shadow-[0_0_10px_var(--color-accent)]" />
          <h1 className="text-sm font-semibold tracking-wide">Cekcok Kroma</h1>
        </div>
        <div className="flex gap-4 text-xs text-zinc-400">
          <button className="hover:text-foreground transition-colors">File</button>
          <button className="hover:text-foreground transition-colors">Edit</button>
          <button className="hover:text-foreground transition-colors">View</button>
          <button className="hover:text-foreground transition-colors">Export</button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        <Toolbar />
        <MediaBin />
        <ProgramMonitor />
        <Inspector />
      </div>

      {/* Timeline */}
      <Timeline />
    </div>
  );
}

export default App;

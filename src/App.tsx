import { useEffect } from "react";
import { MediaBin } from "./features/media-bin";
import { ProgramMonitor } from "./features/preview";
import { Timeline } from "./features/timeline";
import { Toolbar } from "./features/toolbar";
import { Inspector } from "./features/inspector";
import { DragGhost } from "./components/DragGhost";
import { useEditorStore } from "./stores/useEditorStore";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useAppMenu } from "./hooks/useAppMenu";

function App() {
  const draggedItem = useEditorStore((state) => state.draggedItem);
  const setDraggedItem = useEditorStore((state) => state.setDraggedItem);
  const setDragCursor = useEditorStore((state) => state.setDragCursor);

  // Global Keyboard Shortcuts (Space, V, C, H, Delete, Frame steps)
  useKeyboardShortcuts();
  // Native Menus and Undo/Redo/Save/Open Shortcuts
  useAppMenu();

  // Global Pointer Tracker for Dragging Media to Timeline
  useEffect(() => {
    if (!draggedItem) return;

    const handlePointerMove = (e: PointerEvent) => {
      setDragCursor({ x: e.clientX, y: e.clientY });
    };

    const handlePointerUp = () => {
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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground text-[11px] font-sans select-none">
      {/* Top Half: Media Bin, Effect Controls & Program Monitor */}
      <div className="flex flex-1 overflow-hidden p-0.5 gap-0.5 bg-[#141414]">
        <div className="flex flex-col w-[300px] gap-0.5 shrink-0">
          <MediaBin />
          <Inspector />
        </div>
        <ProgramMonitor />
      </div>

      {/* Bottom Half: Tools & Multi-Track Timeline */}
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

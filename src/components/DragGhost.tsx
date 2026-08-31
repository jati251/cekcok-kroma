import { useEditorStore } from "../stores/useEditorStore";

export function DragGhost() {
  const draggedItem = useEditorStore(state => state.draggedItem);
  const dragCursor = useEditorStore(state => state.dragCursor);

  if (!draggedItem || !dragCursor) return null;

  return (
    <div 
      className="fixed pointer-events-none z-[99999] bg-[#232323] border-2 border-accent rounded px-2.5 py-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.8)] flex items-center gap-2 text-white transform -translate-x-1/2 -translate-y-1/2"
      style={{
        left: dragCursor.x,
        top: dragCursor.y,
      }}
    >
      <div className="w-2.5 h-2.5 rounded-full bg-accent animate-ping" />
      <div className="flex flex-col">
        <span className="text-[11px] font-bold max-w-[150px] truncate">{draggedItem.name}</span>
        <span className="text-[9px] text-[#888] font-mono">{(draggedItem.duration || 5).toFixed(1)}s • Drop on timeline track</span>
      </div>
    </div>
  );
}

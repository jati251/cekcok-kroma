import { DragItem } from "../../../types/editor";
import { useEditorStore } from "../../../stores/useEditorStore";

interface MediaItemCardProps {
  item: DragItem;
}

export function MediaItemCard({ item }: MediaItemCardProps) {
  const setDraggedItem = useEditorStore(state => state.setDraggedItem);
  const setDragCursor = useEditorStore(state => state.setDragCursor);

  const handlePointerDown = (e: React.PointerEvent) => {
    setDraggedItem(item);
    setDragCursor({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      className="aspect-video bg-[#111] border border-[#333] flex items-center justify-center cursor-grab active:cursor-grabbing hover:border-accent group relative overflow-hidden select-none rounded-[2px]"
      onPointerDown={handlePointerDown}
    >
      <div className="text-[10px] text-[#999] truncate px-2 text-center break-all w-full z-10 drop-shadow-md group-hover:text-white transition-colors">
        {item.name}
      </div>
      <div className="absolute bottom-0 right-0 bg-black/80 px-1 text-[9px] text-[#777] font-mono">
        {(item.duration || 0).toFixed(1)}s
      </div>
    </div>
  );
}

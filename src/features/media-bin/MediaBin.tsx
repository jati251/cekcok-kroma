import { useEditorStore, DragItem } from "../../stores/useEditorStore";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

export function MediaBin() {
  const setDraggedItem = useEditorStore(state => state.setDraggedItem);
  const mediaItems = useEditorStore(state => state.mediaItems);
  const addMediaItem = useEditorStore(state => state.addMediaItem);

  const handleImport = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Video',
          extensions: ['mp4', 'mov', 'webm']
        }]
      });
      
      if (typeof selected === 'string') {
        // Get duration by calling Rust backend (ffprobe)
        try {
          const metadata: { duration: number } = await invoke('get_video_metadata', { path: selected });
          const newItem: DragItem = {
            id: `media-${Date.now()}`,
            type: "media",
            name: selected.split('/').pop() || selected.split('\\').pop() || "Video",
            color: "#3b82f6",
            src: selected,
            duration: metadata.duration,
          };
          addMediaItem(newItem);
        } catch (error) {
          console.error("FFprobe error:", error);
        }
      }
    } catch (err) {
      console.error("Failed to import media", err);
    }
  };

  const setDragCursor = useEditorStore(state => state.setDragCursor);

  return (
    <div className="flex-1 flex flex-col bg-[var(--panel-bg)] border border-[var(--panel-border)]">
      <div className="h-6 px-3 flex items-center justify-between bg-[#2d2d2d] border-b border-[#111]">
        <span className="text-[11px] text-[#ccc]">Project Media</span>
        <button 
          onClick={handleImport}
          className="text-[10px] text-accent hover:text-white transition-colors cursor-pointer"
        >
          Import
        </button>
      </div>
      <div className="flex-1 p-2 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          {mediaItems.map((item) => (
            <div
              key={item.id}
              className="aspect-video bg-[#111] border border-[#333] flex items-center justify-center cursor-grab active:cursor-grabbing hover:border-accent group relative overflow-hidden select-none"
              onPointerDown={(e) => {
                setDraggedItem(item);
                setDragCursor({ x: e.clientX, y: e.clientY });
              }}
            >
              <div className="text-[10px] text-[#999] truncate px-2 text-center break-all w-full z-10 drop-shadow-md group-hover:text-white transition-colors">
                {item.name}
              </div>
              <div className="absolute bottom-0 right-0 bg-black/80 px-1 text-[9px] text-[#777]">
                {(item.duration || 0).toFixed(1)}s
              </div>
            </div>
          ))}
          
          {mediaItems.length === 0 && (
            <div className="col-span-2 text-center text-[#555] mt-10">
              No media.<br/>Click Import to add files.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

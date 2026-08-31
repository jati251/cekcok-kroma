import { motion } from "framer-motion";
import { useEditorStore, DragItem } from "../../stores/useEditorStore";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

export function MediaBin() {
  const { setDraggedItem, mediaItems, addMediaItem } = useEditorStore();

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

  return (
    <div className="w-1/4 border-r border-border bg-secondary flex flex-col h-full">
      <div className="p-2 border-b border-border text-xs font-medium uppercase tracking-wider text-zinc-400 flex justify-between items-center">
        <span>Project Media</span>
        <button 
          onClick={handleImport}
          className="text-[10px] bg-primary hover:bg-accent hover:text-white px-2 py-1 rounded transition-colors"
        >
          Import
        </button>
      </div>
      <div className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto">
        {mediaItems.map((item) => (
          <motion.div
            key={item.id}
            drag
            dragSnapToOrigin
            onDragStart={() => setDraggedItem(item)}
            onDragEnd={() => setDraggedItem(null)}
            className="p-3 bg-primary border border-border rounded shadow-sm cursor-grab active:cursor-grabbing flex flex-col gap-1 hover:bg-primary/80 transition-colors z-10"
            whileDrag={{ scale: 1.05, opacity: 0.8, zIndex: 50 }}
          >
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-sm text-zinc-300 truncate font-medium">{item.name}</span>
            </div>
            {item.duration && (
              <span className="text-[10px] text-zinc-500 pl-5">
                {(item.duration).toFixed(2)}s
              </span>
            )}
          </motion.div>
        ))}
        {mediaItems.length === 0 && (
          <div className="text-sm text-zinc-600 text-center mt-10 p-4 border border-dashed border-zinc-700 rounded bg-primary/30">
            Click Import to add videos
          </div>
        )}
      </div>
    </div>
  );
}

import { useEditorStore } from "../../stores/useEditorStore";

export function Inspector() {
  const selectedClipId = useEditorStore(state => state.selectedClipId);
  const tracks = useEditorStore(state => state.tracks);

  let selectedItem = null;
  if (selectedClipId) {
    for (const track of tracks) {
      const found = track.items.find(i => i.id === selectedClipId);
      if (found) {
        selectedItem = found;
        break;
      }
    }
  }

  return (
    <div className="h-1/2 bg-[var(--panel-bg)] border border-[var(--panel-border)] flex flex-col">
      <div className="h-6 px-3 flex items-center bg-[#2d2d2d] border-b border-[#111]">
        <span className="text-[11px] text-[#ccc]">Effect Controls</span>
      </div>
      <div className="p-3 flex-1 overflow-y-auto text-[#aaa]">
        {selectedItem ? (
          <div className="space-y-4">
            <div className="font-semibold text-white">{selectedItem.name}</div>
            
            <div className="space-y-2 pt-2">
              <div className="text-[10px] uppercase text-[#777] font-bold tracking-wider">Video Effects</div>
              
              <div className="pl-2 space-y-2">
                <div className="flex justify-between items-center border-b border-[var(--panel-border)] pb-1 group">
                  <span className="group-hover:text-white transition-colors">Position</span>
                  <div className="flex gap-2">
                    <span className="text-accent cursor-ew-resize">960</span>
                    <span className="text-accent cursor-ew-resize">540</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center border-b border-[var(--panel-border)] pb-1 group">
                  <span className="group-hover:text-white transition-colors">Scale</span>
                  <span className="text-accent cursor-ew-resize">100.0</span>
                </div>
                
                <div className="flex justify-between items-center border-b border-[var(--panel-border)] pb-1 group">
                  <span className="group-hover:text-white transition-colors">Opacity</span>
                  <span className="text-accent cursor-ew-resize">100.0%</span>
                </div>
              </div>
            </div>
            
            <div className="pt-4 mt-4 border-t border-[var(--panel-border)] space-y-1">
              <div className="text-[10px] uppercase text-[#777] font-bold tracking-wider mb-2">Properties</div>
              <div className="text-[10px] text-[#888] flex justify-between">
                <span>In Point:</span> <span className="font-mono">{(selectedItem.start || 0).toFixed(2)}s</span>
              </div>
              <div className="text-[10px] text-[#888] flex justify-between">
                <span>Duration:</span> <span className="font-mono">{(selectedItem.duration || 0).toFixed(2)}s</span>
              </div>
              <div className="text-[10px] text-[#888] flex justify-between">
                <span>Out Point:</span> <span className="font-mono">{((selectedItem.start || 0) + (selectedItem.duration || 0)).toFixed(2)}s</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-[#555] text-center mt-4">No Clip Selected</div>
        )}
      </div>
    </div>
  );
}

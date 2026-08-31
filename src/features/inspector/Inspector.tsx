import { useEditorStore } from "../../stores/useEditorStore";

export function Inspector() {
  const { selectedClipId } = useEditorStore();

  return (
    <div className="w-64 border-l border-border bg-secondary flex flex-col h-full">
      <div className="p-2 border-b border-border text-xs font-medium uppercase tracking-wider text-zinc-400">
        Properties
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        {selectedClipId ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200 mb-3">Transform</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Position X</span>
                  <input type="number" defaultValue={0} className="w-16 bg-primary border border-border rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-accent" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Position Y</span>
                  <input type="number" defaultValue={0} className="w-16 bg-primary border border-border rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-accent" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Scale</span>
                  <div className="flex items-center gap-1">
                    <input type="number" defaultValue={100} className="w-16 bg-primary border border-border rounded px-2 py-1 text-xs text-right focus:outline-none focus:border-accent" />
                    <span className="text-xs text-zinc-500">%</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="h-px bg-border w-full" />
            
            <div>
              <h3 className="text-sm font-semibold text-zinc-200 mb-3">Opacity</h3>
              <div className="flex items-center gap-2">
                <input type="range" min="0" max="100" defaultValue="100" className="flex-1 accent-accent" />
                <span className="text-xs text-zinc-400 w-8 text-right">100%</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-zinc-600 text-center">
            Select a clip on the timeline to view properties
          </div>
        )}
      </div>
    </div>
  );
}

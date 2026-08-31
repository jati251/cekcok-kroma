import { useEditorStore } from "../../stores/useEditorStore";

export function Toolbar() {
  const { activeTool, setActiveTool } = useEditorStore();

  return (
    <div className="w-10 bg-[var(--panel-bg)] border border-[var(--panel-border)] flex flex-col items-center py-2 gap-2 shrink-0">
      <button 
        className={`w-6 h-6 rounded flex items-center justify-center ${activeTool === "selection" ? "bg-accent text-white" : "text-[#888] hover:bg-[#333]"}`}
        onClick={() => setActiveTool("selection")}
        title="Selection Tool (V)"
      >
        {/* Selection Cursor Icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4l7.07 17 2.51-7.39L21 11.07z" />
        </svg>
      </button>
      
      <button 
        className={`w-6 h-6 rounded flex items-center justify-center ${activeTool === "razor" ? "bg-accent text-white" : "text-[#888] hover:bg-[#333]"}`}
        onClick={() => setActiveTool("razor")}
        title="Razor Tool (C)"
      >
        {/* Razor Icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.5 2L18 5.5l-11 11L3.5 13 14.5 2z" />
          <path d="M19 19h-5" />
        </svg>
      </button>

      <button 
        className={`w-6 h-6 rounded flex items-center justify-center ${activeTool === "hand" ? "bg-accent text-white" : "text-[#888] hover:bg-[#333]"}`}
        onClick={() => setActiveTool("hand")}
        title="Hand Tool (H)"
      >
        {/* Hand Icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 21c-2.4 0-4.6-1.5-5.5-3.8l-2.6-6.4c-.4-1.1.2-2.3 1.3-2.6 1-.3 2.1.2 2.6 1.1L8 12.8V6c0-1.1.9-2 2-2s2 .9 2 2v1h1V4c0-1.1.9-2 2-2s2 .9 2 2v2h1V5c0-1.1.9-2 2-2s2 .9 2 2v6" />
        </svg>
      </button>
    </div>
  );
}

import { useEditorStore } from "../../../stores/useEditorStore";
import { Tool } from "../../../types/editor";

interface ToolButtonConfig {
  id: Tool;
  name: string;
  shortcut: string;
  icon: React.ReactNode;
}

const TOOLS: ToolButtonConfig[] = [
  {
    id: "selection",
    name: "Selection Tool",
    shortcut: "V",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4l7.07 17 2.51-7.39L21 11.07z" />
      </svg>
    ),
  },
  {
    id: "razor",
    name: "Razor Tool",
    shortcut: "C",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14.5 2L18 5.5l-11 11L3.5 13 14.5 2z" />
        <path d="M19 19h-5" />
      </svg>
    ),
  },
  {
    id: "hand",
    name: "Hand Tool",
    shortcut: "H",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 21c-2.4 0-4.6-1.5-5.5-3.8l-2.6-6.4c-.4-1.1.2-2.3 1.3-2.6 1-.3 2.1.2 2.6 1.1L8 12.8V6c0-1.1.9-2 2-2s2 .9 2 2v1h1V4c0-1.1.9-2 2-2s2 .9 2 2v2h1V5c0-1.1.9-2 2-2s2 .9 2 2v6" />
      </svg>
    ),
  },
];

export function Toolbar() {
  const activeTool = useEditorStore((state) => state.activeTool);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);

  return (
    <div className="w-10 bg-[var(--panel-bg)] border border-[var(--panel-border)] flex flex-col items-center py-2 gap-2 shrink-0 select-none">
      {TOOLS.map((tool) => {
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            title={`${tool.name} (${tool.shortcut})`}
            className={`w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors ${
              isActive ? "bg-accent text-white" : "text-[#888] hover:bg-[#333] hover:text-white"
            }`}
          >
            {tool.icon}
          </button>
        );
      })}
    </div>
  );
}

import { MousePointer2, Scissors, Hand } from "lucide-react";
import { useEditorStore, Tool } from "../../stores/useEditorStore";

export function Toolbar() {
  const { activeTool, setActiveTool } = useEditorStore();

  const tools: { id: Tool; icon: React.ReactNode; label: string; shortcut: string }[] = [
    { id: "selection", icon: <MousePointer2 size={16} />, label: "Selection Tool", shortcut: "V" },
    { id: "razor", icon: <Scissors size={16} />, label: "Razor Tool", shortcut: "C" },
    { id: "hand", icon: <Hand size={16} />, label: "Hand Tool", shortcut: "H" },
  ];

  return (
    <div className="w-12 border-r border-border bg-secondary flex flex-col items-center py-2 gap-2">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setActiveTool(tool.id)}
          title={`${tool.label} (${tool.shortcut})`}
          className={`p-2 rounded-md transition-colors ${
            activeTool === tool.id
              ? "bg-accent text-accent-foreground shadow-inner"
              : "text-zinc-400 hover:bg-primary hover:text-zinc-200"
          }`}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  );
}

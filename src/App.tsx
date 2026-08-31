import { MediaBin } from "./features/media-bin/MediaBin";
import { ProgramMonitor } from "./features/preview/ProgramMonitor";
import { Timeline } from "./features/timeline/Timeline";
import { Toolbar } from "./features/toolbar/Toolbar";
import { Inspector } from "./features/inspector/Inspector";

function App() {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-primary">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-accent rounded-sm shadow-[0_0_10px_var(--color-accent)]" />
          <h1 className="text-sm font-semibold tracking-wide">Cekcok Kroma</h1>
        </div>
        <div className="flex gap-4 text-xs text-zinc-400">
          <button className="hover:text-foreground transition-colors">File</button>
          <button className="hover:text-foreground transition-colors">Edit</button>
          <button className="hover:text-foreground transition-colors">View</button>
          <button className="hover:text-foreground transition-colors">Export</button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        <Toolbar />
        <MediaBin />
        <ProgramMonitor />
        <Inspector />
      </div>

      {/* Timeline */}
      <Timeline />
    </div>
  );
}

export default App;

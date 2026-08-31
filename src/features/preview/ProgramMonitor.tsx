import { motion } from "framer-motion";
import { useDragStore } from "../../stores/useDragStore";

export function ProgramMonitor() {
  const { draggedItem } = useDragStore();

  return (
    <div className="flex-1 flex flex-col bg-background h-full">
      <div className="p-2 border-b border-border text-xs font-medium uppercase tracking-wider text-zinc-400">
        Program Monitor
      </div>
      <div className="flex-1 p-4 flex items-center justify-center relative">
        <div className="w-full aspect-video bg-black rounded-md border border-border shadow-lg flex items-center justify-center overflow-hidden">
          {draggedItem ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-accent/10 border-2 border-dashed border-accent flex items-center justify-center pointer-events-none"
            >
              <span className="text-accent text-sm font-medium">
                Drop to Play
              </span>
            </motion.div>
          ) : null}
          <span className="text-zinc-700 font-mono">No Media Selected</span>
        </div>
      </div>
    </div>
  );
}

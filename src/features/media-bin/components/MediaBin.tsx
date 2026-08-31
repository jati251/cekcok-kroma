import { useEditorStore } from "../../../stores/useEditorStore";
import { importMediaFile } from "../api/importMedia";
import { MediaItemCard } from "./MediaItemCard";

export function MediaBin() {
  const mediaItems = useEditorStore(state => state.mediaItems);
  const addMediaItem = useEditorStore(state => state.addMediaItem);

  const handleImportClick = async () => {
    const newMedia = await importMediaFile();
    if (newMedia) {
      addMediaItem(newMedia);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--panel-bg)] border border-[var(--panel-border)]">
      <div className="h-6 px-3 flex items-center justify-between bg-[#2d2d2d] border-b border-[#111]">
        <span className="text-[11px] text-[#ccc] font-medium">Project Media</span>
        <button
          onClick={handleImportClick}
          className="text-[10px] text-accent hover:text-white transition-colors cursor-pointer"
        >
          Import
        </button>
      </div>

      <div className="flex-1 p-2 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2">
          {mediaItems.map((item) => (
            <MediaItemCard key={item.id} item={item} />
          ))}

          {mediaItems.length === 0 && (
            <div className="col-span-2 text-center text-[#555] mt-10">
              No media.<br />Click Import to add files.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

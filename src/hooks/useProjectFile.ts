import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { useEditorStore, DocumentState } from "../stores/useEditorStore";

export function useProjectFile() {
  const projectFilePath = useEditorStore((state) => state.projectFilePath);
  const setProjectFilePath = useEditorStore((state) => state.setProjectFilePath);
  const tracks = useEditorStore((state) => state.tracks);
  const mediaItems = useEditorStore((state) => state.mediaItems);
  const loadDocumentState = useEditorStore((state) => state.loadDocumentState);

  const handleSaveProject = async () => {
    try {
      let path = projectFilePath;

      if (!path) {
        path = await save({
          filters: [{ name: "Kroma Project", extensions: ["krm"] }],
          title: "Save Project",
        });

        if (!path) return; // User canceled
        setProjectFilePath(path);
      }

      const docState: DocumentState = {
        tracks,
        mediaItems,
      };

      const data = JSON.stringify(docState, null, 2);
      await invoke("save_project", { path, data });
      console.log("Project saved to", path);
    } catch (e) {
      console.error("Failed to save project:", e);
    }
  };

  const handleSaveProjectAs = async () => {
    try {
      const path = await save({
        filters: [{ name: "Kroma Project", extensions: ["krm"] }],
        title: "Save Project As",
        defaultPath: projectFilePath || undefined,
      });

      if (!path) return;
      setProjectFilePath(path);

      const docState: DocumentState = {
        tracks,
        mediaItems,
      };

      const data = JSON.stringify(docState, null, 2);
      await invoke("save_project", { path, data });
      console.log("Project saved to", path);
    } catch (e) {
      console.error("Failed to save project as:", e);
    }
  };

  const handleOpenProject = async () => {
    try {
      const selected = await open({
        filters: [{ name: "Kroma Project", extensions: ["krm"] }],
        multiple: false,
        title: "Open Project",
      });

      if (!selected) return;

      const path = Array.isArray(selected) ? selected[0] : selected;
      if (!path) return;

      const data = await invoke<string>("load_project", { path });
      const docState = JSON.parse(data) as DocumentState;
      
      // Basic validation
      if (docState.tracks && docState.mediaItems) {
        loadDocumentState(docState);
        setProjectFilePath(path);
        console.log("Project loaded from", path);
      } else {
        console.error("Invalid project file format.");
      }
    } catch (e) {
      console.error("Failed to open project:", e);
    }
  };

  return {
    handleSaveProject,
    handleSaveProjectAs,
    handleOpenProject,
  };
}

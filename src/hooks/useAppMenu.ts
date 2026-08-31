import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useProjectFile } from "./useProjectFile";
import { useEditorStore } from "../stores/useEditorStore";

export function useAppMenu() {
  const { handleSaveProject, handleSaveProjectAs, handleOpenProject } = useProjectFile();
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  useEffect(() => {
    const unlistenPromise = listen("native-menu-action", (event) => {
      const actionId = event.payload as string;
      
      switch (actionId) {
        case "open_project":
          handleOpenProject();
          break;
        case "save_project":
          handleSaveProject();
          break;
        case "save_project_as":
          handleSaveProjectAs();
          break;
        case "undo_action":
          undo();
          break;
        case "redo_action":
          redo();
          break;
        // other native menu events like cut, copy, paste can be handled here if needed
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [handleSaveProject, handleSaveProjectAs, handleOpenProject, undo, redo]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.userAgent.toUpperCase().indexOf("MAC") >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl) {
        if (e.key.toLowerCase() === "z") {
          if (e.shiftKey) {
            e.preventDefault();
            redo();
          } else {
            e.preventDefault();
            undo();
          }
        } else if (e.key.toLowerCase() === "s") {
          e.preventDefault();
          if (e.shiftKey) {
            handleSaveProjectAs();
          } else {
            handleSaveProject();
          }
        } else if (e.key.toLowerCase() === "o") {
          e.preventDefault();
          handleOpenProject();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveProject, handleSaveProjectAs, handleOpenProject, undo, redo]);
}

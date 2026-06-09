import * as React from "react";

interface UndoRedoActions {
  undo: () => void;
  redo: () => void;
}

export function useKeyboardUndoRedo({ undo, redo }: UndoRedoActions, enabled = true) {
  React.useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, enabled]);
}

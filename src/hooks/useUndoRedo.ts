import * as React from "react";

interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useUndoRedo<T>(initial: T) {
  const [state, setState] = React.useState<UndoRedoState<T>>({
    past: [],
    present: initial,
    future: [],
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const set = React.useCallback((newPresent: T) => {
    setState((prev) => ({
      past: [...prev.past.slice(-50), prev.present],
      present: newPresent,
      future: [],
    }));
  }, []);

  const undo = React.useCallback(() => {
    setState((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      return {
        past: prev.past.slice(0, -1),
        present: previous,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);

  const redo = React.useCallback(() => {
    setState((prev) => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      return {
        past: [...prev.past, prev.present],
        present: next,
        future: prev.future.slice(1),
      };
    });
  }, []);

  const reset = React.useCallback((newInitial: T) => {
    setState({ past: [], present: newInitial, future: [] });
  }, []);

  return { present: state.present, set, undo, redo, reset, canUndo, canRedo };
}

import * as React from "react";

export type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

const DRAFT_PREFIX = "draft:";

function draftKey(key: string): string {
  return `${DRAFT_PREFIX}${key}`;
}

interface UseAutoSaveOptions<T extends Record<string, unknown>> {
  key: string;
  data: T;
  delay?: number;
  enabled?: boolean;
}

interface UseAutoSaveReturn<T> {
  status: SaveStatus;
  clearDraft: () => void;
  hasDraft: () => boolean;
  restoreDraft: () => T | null;
}

export function useAutoSave<T extends Record<string, unknown>>({
  key,
  data,
  delay = 2000,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn<T> {
  const [status, setStatus] = React.useState<SaveStatus>("idle");
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = React.useRef(key);
  const dataRef = React.useRef(data);
  const hasDataRef = React.useRef(false);
  keyRef.current = key;
  dataRef.current = data;

  const save = React.useCallback(function save() {
    try {
      localStorage.setItem(draftKey(keyRef.current), JSON.stringify(dataRef.current));
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, []);

  React.useEffect(() => {
    if (!enabled) return;
    const keys = Object.keys(data);
    if (keys.length === 0) return;
    const allEmpty = keys.every((k) => {
      const v = (data as Record<string, unknown>)[k];
      return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && v !== null && Object.keys(v).length === 0);
    });
    if (allEmpty && !hasDataRef.current) return;
    hasDataRef.current = true;

    setStatus("unsaved");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, delay, enabled, save]);

  const clearDraft = React.useCallback(() => {
    try {
      localStorage.removeItem(draftKey(keyRef.current));
    } catch {
      /* empty */
    }
    setStatus("idle");
    hasDataRef.current = false;
  }, []);

  const hasDraft = React.useCallback((): boolean => {
    try {
      return localStorage.getItem(draftKey(keyRef.current)) !== null;
    } catch {
      return false;
    }
  }, []);

  const restoreDraft = React.useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(draftKey(keyRef.current));
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }, []);

  return { status, clearDraft, hasDraft, restoreDraft };
}

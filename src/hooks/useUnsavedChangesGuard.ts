import * as React from "react";
import { useBlocker } from "react-router-dom";

interface UnsavedChangesGuardOptions {
  useNativeNavigationConfirm?: boolean;
}

export function useUnsavedChangesGuard(
  enabled: boolean,
  message: string,
  options?: UnsavedChangesGuardOptions,
) {
  const useNativeNavigationConfirm = options?.useNativeNavigationConfirm ?? true;
  React.useEffect(() => {
    if (!enabled) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled, message]);

  const blocker = useBlocker(enabled);

  React.useEffect(() => {
    if (!useNativeNavigationConfirm || blocker.state !== "blocked") return;
    if (window.confirm(message)) {
      blocker.proceed();
      return;
    }
    blocker.reset();
  }, [blocker, message, useNativeNavigationConfirm]);

  return blocker;
}

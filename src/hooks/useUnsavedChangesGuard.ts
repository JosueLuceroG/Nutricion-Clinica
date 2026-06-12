import * as React from "react";
import { useBlocker } from "react-router-dom";

export function useUnsavedChangesGuard(enabled: boolean, message: string): void {
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
    if (blocker.state !== "blocked") return;
    if (window.confirm(message)) {
      blocker.proceed();
      return;
    }
    blocker.reset();
  }, [blocker, message]);
}

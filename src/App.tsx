import * as React from "react";
import { ThemeProvider } from "@app/providers/ThemeProvider";
import { NotificationProvider } from "@app/providers/NotificationProvider";
import { AppRouter } from "@app/router";
import { TooltipProvider } from "@components/ui/tooltip";

export function App() {
  React.useEffect(() => {
    let disposed = false;
    let stop: (() => void) | null = null;

    void (async () => {
      const [{ db }, { startSync, stopSync }, { getSyncEnqueuer }] = await Promise.all([
        import("@services/db"),
        import("@services/sync/syncBootstrap"),
        import("@services/sync/syncEnqueuerBootstrap"),
      ]);

      if (disposed) return;

      // Legacy JSON with competing representations requires explicit review.
      // Startup must not discard a field or manufacture a clinical mutation.

      // Singleton a nivel de módulo: una sola instancia para toda la vida
      // del bundle. Evita que StrictMode/HMR acumulen hooks de Dexie.
      getSyncEnqueuer();
      startSync(db, { intervalMs: 30_000, runOnStart: false });
      stop = stopSync;
    })();

    return () => {
      disposed = true;
      stop?.();
    };
    // Si aparece en consola "Cannot update a component while rendering",
    // ver docs/development/setState-during-render.md.
  }, []);

  return (
    <ThemeProvider>
      <NotificationProvider>
        <TooltipProvider delayDuration={300}>
          <AppRouter />
        </TooltipProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

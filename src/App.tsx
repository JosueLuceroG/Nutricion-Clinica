import * as React from "react";
import { ThemeProvider } from "@app/providers/ThemeProvider";
import { NotificationProvider } from "@app/providers/NotificationProvider";
import { AppRouter } from "@app/router";
import { Toaster } from "sonner";
import { TooltipProvider } from "@components/ui/tooltip";

export function App() {
  React.useEffect(() => {
    let disposed = false;
    let stop: (() => void) | null = null;

    void (async () => {
      const [{ db }, { startSync, stopSync }, { getSyncEnqueuer }, { fixLegacyJsonColumns }] = await Promise.all([
        import("@services/db"),
        import("@services/sync/syncBootstrap"),
        import("@services/sync/syncEnqueuerBootstrap"),
        import("@services/db/fixLegacyJsonColumns"),
      ]);

      if (disposed) return;

      // Migración one-time: repara filas con JSON columns como objeto/array
      // (legacy anterior al fix toLocalRow en syncEngine). Corre una vez por
      // sesión, no bloquea el render.
      void fixLegacyJsonColumns(db);

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
          <Toaster position="top-right" richColors={false} closeButton />
        </TooltipProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

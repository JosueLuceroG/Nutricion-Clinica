import * as React from "react";
import { ThemeProvider } from "@app/providers/ThemeProvider";
import { NotificationProvider } from "@app/providers/NotificationProvider";
import { AppRouter } from "@app/router";
import { Toaster } from "sonner";
import { TooltipProvider } from "@components/ui/tooltip";
import { db } from "@services/db";
import { startSync, stopSync } from "@services/sync/syncBootstrap";
import { getSyncEnqueuer } from "@services/sync/syncEnqueuerBootstrap";

export function App() {
  React.useEffect(() => {
    // Singleton a nivel de módulo: una sola instancia para toda la vida
    // del bundle. Evita que StrictMode/HMR acumulen hooks de Dexie.
    getSyncEnqueuer();
    startSync(db, { intervalMs: 30_000, runOnStart: false });
    return () => {
      stopSync();
    };
  }, []);

  return (
    <ThemeProvider>
      <NotificationProvider>
        <TooltipProvider delayDuration={300}>
          <AppRouter />
          <Toaster position="bottom-right" richColors closeButton />
        </TooltipProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

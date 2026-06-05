import * as React from "react";
import { ThemeProvider } from "@app/providers/ThemeProvider";
import { NotificationProvider } from "@app/providers/NotificationProvider";
import { AppRouter } from "@app/router";
import { Toaster } from "sonner";
import { TooltipProvider } from "@components/ui/tooltip";
import { db } from "@services/db";
import { startSync, stopSync } from "@services/sync/syncBootstrap";
import { SyncEnqueuer } from "@services/sync/syncEnqueuer";
import { SyncQueueRepository } from "@services/sync/syncQueueRepository";

export function App() {
  React.useEffect(() => {
    const enqueuer = new SyncEnqueuer(db, new SyncQueueRepository(db.sync_queue));
    enqueuer.start();
    startSync(db, { intervalMs: 30_000, runOnStart: false });
    return () => {
      enqueuer.stop();
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

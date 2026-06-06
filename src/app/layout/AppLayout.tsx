import * as React from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { StatusBar } from "./StatusBar";
import { CommandPalette } from "./CommandPalette";
import { ContextPanel } from "./ContextPanel";
import { useUIStore } from "@store/uiStore";
import { cn } from "@utils/cn";

const PageFallback = (
  <div className="flex h-full items-center justify-center p-12 text-sm text-muted-foreground">
    <div className="flex flex-col items-center gap-3">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      Cargando…
    </div>
  </div>
);

export function AppLayout() {
  const contextOpen = useUIStore((s) => s.contextPanelOpen);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />

        <div className="flex flex-1 overflow-hidden">
          <main
            id="main-content"
            className="flex-1 overflow-y-auto"
            tabIndex={-1}
            aria-label="Contenido principal"
          >
            <React.Suspense fallback={PageFallback}>
              <Outlet />
            </React.Suspense>
          </main>

          {contextOpen && <ContextPanel />}
        </div>

        <StatusBar />
      </div>

      <CommandPalette />
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-b bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-6", className)}>{children}</div>;
}

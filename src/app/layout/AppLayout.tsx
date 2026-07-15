import * as React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { StatusBar } from "./StatusBar";
import { CommandPalette } from "./CommandPalette";
import { ContextPanel } from "./ContextPanel";
import { NotificationScopeController } from "./NotificationScopeController";
import { QuickNotesProvider } from "@modules/quick-notes/ui";
import { DashboardQuickAccessScopeController } from "@modules/dashboard-quick-access/ui";
import { useUIStore } from "@store/uiStore";
import { cn } from "@utils/cn";

function PageFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full items-center justify-center p-12 text-sm text-muted-foreground">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        {t("common.loading")}
      </div>
    </div>
  );
}

export function AppLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const contextOpen = useUIStore((s) => s.contextPanelOpen);
  const isDashboardRoute = location.pathname === "/";

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      <NotificationScopeController />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:ring-2 focus:ring-ring focus:rounded-md"
      >
        {t("common.skip_to_content")}
      </a>

      {!isDashboardRoute && <Sidebar />}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {!isDashboardRoute && <Header />}

        <div className="flex min-w-0 flex-1 overflow-hidden">
          <main
            id="main-content"
            className={cn("min-w-0 flex-1 overflow-y-auto", isDashboardRoute && "bg-[#f7faff]")}
            tabIndex={-1}
            aria-label={t("layout.main_content")}
          >
            <React.Suspense fallback={<PageFallback />}>
              <Outlet />
            </React.Suspense>
          </main>

          <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" />

          {!isDashboardRoute && contextOpen && <ContextPanel />}
        </div>

        {!isDashboardRoute && <StatusBar />}
      </div>

      <QuickNotesProvider />
      <DashboardQuickAccessScopeController />
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
        "flex min-w-0 flex-col gap-3 border-b bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="break-words text-xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="break-words text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div>}
    </div>
  );
}

export function PageContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("min-w-0 p-4 sm:p-6", className)}>{children}</div>;
}

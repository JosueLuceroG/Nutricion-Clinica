import * as React from "react";
import { BottomStatusBar } from "./BottomStatusBar";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardMobileNav } from "./DashboardMobileNav";
import { DashboardSidebar } from "./DashboardSidebar";
import "./DashboardPage.css";

interface DashboardShellProps {
  children: React.ReactNode;
  onCustomizeKpis?: () => void;
}

export function DashboardShell({ children, onCustomizeKpis }: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  return (
    <div className={`nc-dashboard-shell${sidebarCollapsed ? " nc-dashboard-shell--collapsed" : ""}`}>
      <DashboardSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
      />

      <div className="nc-dashboard-workspace">
        <DashboardHeader onCustomizeKpis={onCustomizeKpis} />
        <DashboardMobileNav />

        <main className="nc-dashboard-main" aria-label="Dashboard NutriClinica">
          <div className="nc-dashboard-container">{children}</div>
        </main>

        <BottomStatusBar />
      </div>
    </div>
  );
}

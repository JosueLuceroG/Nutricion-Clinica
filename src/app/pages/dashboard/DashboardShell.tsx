import * as React from "react";
import { Maximize2, Minimize2, Minus, Monitor, Moon, Square, Sun, X } from "lucide-react";
import { useTheme } from "@app/providers/ThemeProvider";
import { BottomStatusBar } from "./BottomStatusBar";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardMobileNav } from "./DashboardMobileNav";
import { DashboardSidebar } from "./DashboardSidebar";
import "./DashboardPage.css";

interface DashboardShellProps {
  children: React.ReactNode;
  onCustomizeKpis?: () => void;
}

function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const tauriWindow = window as Window & { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
  return Boolean(tauriWindow.__TAURI__ || tauriWindow.__TAURI_INTERNALS__);
}

function useIsTauriDesktop() {
  const [isTauriDesktop, setIsTauriDesktop] = React.useState(false);

  React.useEffect(() => {
    setIsTauriDesktop(isTauriRuntime());
  }, []);

  return isTauriDesktop;
}

async function getCurrentTauriWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

function DesktopWindowTitlebar() {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const ThemeIcon = resolvedTheme === "dark" ? Moon : Sun;
  const themeLabel = resolvedTheme === "dark" ? "Oscuro" : "Claro";
  const nextThemeLabel = resolvedTheme === "dark" ? "claro" : "oscuro";

  const toggleDashboardTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  React.useEffect(() => {
    let mounted = true;

    const enterInitialFullscreen = async () => {
      const appWindow = await getCurrentTauriWindow();
      await appWindow.setFullscreen(true);
      const fullscreen = await appWindow.isFullscreen();
      if (mounted) setIsFullscreen(fullscreen);
    };

    const toggleFullscreenFromKeyboard = (event: KeyboardEvent) => {
      if (event.key !== "F11") return;
      event.preventDefault();

      void getCurrentTauriWindow()
        .then(async (appWindow) => {
          const fullscreen = await appWindow.isFullscreen();
          await appWindow.setFullscreen(!fullscreen);
          const nextFullscreen = await appWindow.isFullscreen();
          if (mounted) setIsFullscreen(nextFullscreen);
        })
        .catch(() => undefined);
    };

    void enterInitialFullscreen().catch(() => undefined);
    window.addEventListener("keydown", toggleFullscreenFromKeyboard);

    return () => {
      mounted = false;
      window.removeEventListener("keydown", toggleFullscreenFromKeyboard);
    };
  }, []);

  const handleDragStart = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    if (isFullscreen) return;
    void getCurrentTauriWindow().then((appWindow) => appWindow.startDragging());
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    if (isFullscreen) return;
    void getCurrentTauriWindow().then((appWindow) => appWindow.toggleMaximize());
  };

  const minimizeWindow = () => {
    void getCurrentTauriWindow().then((appWindow) => appWindow.minimize());
  };

  const toggleMaximizeWindow = () => {
    void getCurrentTauriWindow()
      .then(async (appWindow) => {
        const fullscreen = await appWindow.isFullscreen();
        if (fullscreen) {
          await appWindow.setFullscreen(false);
          const nextFullscreen = await appWindow.isFullscreen();
          setIsFullscreen(nextFullscreen);
          return;
        }

        await appWindow.toggleMaximize();
      })
      .catch(() => undefined);
  };

  const toggleFullscreenWindow = () => {
    void getCurrentTauriWindow()
      .then(async (appWindow) => {
        const fullscreen = await appWindow.isFullscreen();
        await appWindow.setFullscreen(!fullscreen);
        const nextFullscreen = await appWindow.isFullscreen();
        setIsFullscreen(nextFullscreen);
      })
      .catch(() => undefined);
  };

  const closeWindow = () => {
    void getCurrentTauriWindow().then((appWindow) => appWindow.close());
  };

  return (
    <div
      className="nc-dashboard-desktop-titlebar"
      aria-label="Barra de ventana NutriClinica"
      onDoubleClick={handleDoubleClick}
      onPointerDown={handleDragStart}
    >
      <div className="nc-dashboard-desktop-titlebar__brand">
        <img src="/assets/icon.png" alt="" width="18" height="18" aria-hidden="true" />
        <span className="nc-dashboard-desktop-titlebar__name">NutriClinica</span>
        <span className="nc-dashboard-desktop-titlebar__separator" aria-hidden="true" />
        <span className="nc-dashboard-desktop-titlebar__subtitle">Gestión Clínica y Nutricional</span>
        <span className="nc-dashboard-desktop-titlebar__desktopIndicator" title="Modo escritorio" aria-label="Modo escritorio">
          <Monitor size={11} strokeWidth={2} aria-hidden="true" />
        </span>
      </div>
      <div className="nc-dashboard-desktop-titlebar__controls" aria-label="Controles de ventana">
        <button
          type="button"
          className="nc-dashboard-desktop-titlebar__theme"
          aria-label={`Cambiar a modo ${nextThemeLabel}. Actual: ${themeLabel}`}
          title={`Cambiar a modo ${nextThemeLabel}`}
          onClick={toggleDashboardTheme}
        >
          <ThemeIcon size={13} strokeWidth={2} aria-hidden="true" />
        </button>
        <button type="button" onClick={minimizeWindow} aria-label="Minimizar ventana">
          <Minus size={14} strokeWidth={2} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={toggleFullscreenWindow}
          aria-label={isFullscreen ? "Salir de pantalla completa (F11)" : "Entrar en pantalla completa (F11)"}
          aria-pressed={isFullscreen}
          title="Alternar pantalla completa (F11)"
        >
          {isFullscreen ? <Minimize2 size={14} strokeWidth={2} aria-hidden="true" /> : <Maximize2 size={14} strokeWidth={2} aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={toggleMaximizeWindow}
          aria-label={isFullscreen ? "Salir de pantalla completa y restaurar ventana" : "Maximizar o restaurar ventana"}
        >
          <Square size={12} strokeWidth={2} aria-hidden="true" />
        </button>
        <button type="button" className="nc-dashboard-desktop-titlebar__close" onClick={closeWindow} aria-label="Cerrar ventana">
          <X size={15} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function DashboardShell({ children, onCustomizeKpis }: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const isTauriDesktop = useIsTauriDesktop();

  return (
    <div className={`nc-dashboard-shell${sidebarCollapsed ? " nc-dashboard-shell--collapsed" : ""}${isTauriDesktop ? " nc-dashboard-shell--tauri" : ""}`}>
      {isTauriDesktop && <DesktopWindowTitlebar />}

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

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme =
  | "light"
  | "dark"
  | "alternative"
  | "system"
  | "high-contrast";

interface UIState {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  contextPanelOpen: boolean;
  theme: Theme;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  setContextPanelOpen: (open: boolean) => void;
  toggleContextPanel: () => void;
  setTheme: (theme: Theme) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      contextPanelOpen: true,
      theme: "system",
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
      toggleMobileSidebar: () =>
        set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
      setContextPanelOpen: (contextPanelOpen) => set({ contextPanelOpen }),
      toggleContextPanel: () =>
        set((state) => ({ contextPanelOpen: !state.contextPanelOpen })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "ui-store",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        contextPanelOpen: state.contextPanelOpen,
        theme: state.theme,
      }),
    },
  ),
);

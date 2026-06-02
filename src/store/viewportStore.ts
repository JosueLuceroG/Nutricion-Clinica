import { create } from "zustand";

interface ViewportState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  sidebarWidth: number;
  setViewport: (width: number) => void;
  setSidebarWidth: (width: number) => void;
}

export const useViewportStore = create<ViewportState>((set) => ({
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  sidebarWidth: 280,
  setViewport: (width) =>
    set({
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024,
    }),
  setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
}));

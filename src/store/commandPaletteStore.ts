import { create } from "zustand";

export type CommandPaletteIntent = "new-consultation" | "new-plan";

interface CommandPaletteState {
  open: boolean;
  intent: CommandPaletteIntent | null;
  setOpen: (open: boolean) => void;
  openWithIntent: (intent: CommandPaletteIntent) => void;
  clearIntent: () => void;
  toggle: () => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  open: false,
  intent: null,
  setOpen: (open) => set({ open, ...(!open ? { intent: null } : {}) }),
  openWithIntent: (intent) => set({ open: true, intent }),
  clearIntent: () => set({ intent: null }),
  toggle: () => set((state) => ({ open: !state.open })),
}));

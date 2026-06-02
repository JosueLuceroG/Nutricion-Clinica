import { create } from "zustand";

interface NotificationState {
  unread: number;
  setUnread: (count: number) => void;
  decrement: () => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unread: 0,
  setUnread: (unread) => set({ unread }),
  decrement: () => set((state) => ({ unread: Math.max(0, state.unread - 1) })),
  clear: () => set({ unread: 0 }),
}));

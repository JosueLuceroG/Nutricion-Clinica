import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GlobalSearchRecentEntry } from "@app/layout/globalSearchTypes";

interface SearchHistoryState {
  entries: GlobalSearchRecentEntry[];
  register: (entry: GlobalSearchRecentEntry) => void;
  clearScope: (scope: string) => void;
}

const MAX_HISTORY_ENTRIES = 48;

export const useSearchHistoryStore = create<SearchHistoryState>()(
  persist(
    (set) => ({
      entries: [],
      register: (entry) =>
        set((state) => ({
          entries: [
            entry,
            ...state.entries.filter(
              (current) =>
                current.scope !== entry.scope ||
                current.resultId !== entry.resultId,
            ),
          ].slice(0, MAX_HISTORY_ENTRIES),
        })),
      clearScope: (scope) =>
        set((state) => ({
          entries: state.entries.filter((entry) => entry.scope !== scope),
        })),
    }),
    {
      name: "global-search-history",
      partialize: (state) => ({ entries: state.entries }),
    },
  ),
);

import { create } from "zustand";

type StatusFilter = "all" | "active" | "inactive" | "archived" | "deleted";

interface PatientsUIState {
  search: string;
  statusFilter: StatusFilter;
  setSearch: (q: string) => void;
  setStatusFilter: (s: StatusFilter) => void;
  reset: () => void;
}

export const usePatientsUIStore = create<PatientsUIState>((set) => ({
  search: "",
  statusFilter: "all",
  setSearch: (search) => set({ search }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  reset: () => set({ search: "", statusFilter: "all" }),
}));

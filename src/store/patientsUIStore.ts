import { create } from "zustand";

interface PatientsUIState {
  search: string;
  statusFilter: "all" | "active" | "inactive" | "archived";
  setSearch: (q: string) => void;
  setStatusFilter: (s: PatientsUIState["statusFilter"]) => void;
  reset: () => void;
}

export const usePatientsUIStore = create<PatientsUIState>((set) => ({
  search: "",
  statusFilter: "all",
  setSearch: (search) => set({ search }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  reset: () => set({ search: "", statusFilter: "all" }),
}));

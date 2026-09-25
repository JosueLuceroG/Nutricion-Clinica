import { create } from "zustand";
import {
  DEFAULT_PATIENT_DIRECTORY_FILTERS,
  type PatientDirectoryFilters,
  type PatientDirectoryStatusFilter,
} from "@modules/patient/application/patientDirectoryTypes";

interface PatientsUIState {
  search: string;
  statusFilter: PatientDirectoryStatusFilter;
  filters: PatientDirectoryFilters;
  pageSize: number;
  setSearch: (q: string) => void;
  setStatusFilter: (s: PatientDirectoryStatusFilter) => void;
  setFilters: (filters: Partial<PatientDirectoryFilters>) => void;
  setPageSize: (pageSize: number) => void;
  reset: () => void;
}

export const usePatientsUIStore = create<PatientsUIState>((set) => ({
  search: "",
  statusFilter: "all",
  filters: DEFAULT_PATIENT_DIRECTORY_FILTERS,
  pageSize: 10,
  setSearch: (search) => set({ search }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
  setPageSize: (pageSize) => set({ pageSize }),
  reset: () =>
    set({
      search: "",
      statusFilter: "all",
      filters: DEFAULT_PATIENT_DIRECTORY_FILTERS,
      pageSize: 10,
    }),
}));

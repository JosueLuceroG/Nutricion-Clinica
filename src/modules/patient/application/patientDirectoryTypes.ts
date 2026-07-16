import type { Patient } from "../domain/Patient";
import type { Sex } from "../domain/Sex";

export type PatientDirectoryStatusFilter =
  | "all"
  | "active"
  | "inactive"
  | "archived"
  | "deleted";

export type PatientDirectoryBooleanFilter = "all" | "with" | "without";
export type PatientDirectorySexFilter = "all" | Sex;

export interface PatientDirectoryFilters {
  sex: PatientDirectorySexFilter;
  minimumAge: number | null;
  maximumAge: number | null;
  registeredFrom: string;
  registeredTo: string;
  tag: string;
  activePlan: PatientDirectoryBooleanFilter;
  upcomingAppointment: PatientDirectoryBooleanFilter;
  pendingBalance: PatientDirectoryBooleanFilter;
}

export interface PatientDirectoryQuery {
  branchId: string | null;
  search: string;
  status: PatientDirectoryStatusFilter;
  filters: PatientDirectoryFilters;
  page: number;
  pageSize: number;
  refreshToken?: number;
}

export interface PatientDirectoryItem {
  patient: Patient;
  initials: string;
  recordNumber: string;
  hasActivePlan: boolean;
  hasUpcomingAppointment: boolean;
  nextAppointmentAt: string | null;
  hasPendingBalance: boolean;
  pendingBalance: number;
}

export interface PatientDirectoryCounts {
  total: number;
  active: number;
  inactive: number;
  archived: number;
  deleted: number;
}

export interface PatientDirectoryResult {
  items: PatientDirectoryItem[];
  filteredTotal: number;
  counts: PatientDirectoryCounts;
  page: number;
  pageSize: number;
  totalPages: number;
  from: number;
  to: number;
}

export const DEFAULT_PATIENT_DIRECTORY_FILTERS: PatientDirectoryFilters = {
  sex: "all",
  minimumAge: null,
  maximumAge: null,
  registeredFrom: "",
  registeredTo: "",
  tag: "",
  activePlan: "all",
  upcomingAppointment: "all",
  pendingBalance: "all",
};

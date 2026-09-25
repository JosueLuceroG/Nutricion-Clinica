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
export type PatientDirectoryClinicalSegment =
  | "all"
  | "on-track"
  | "follow-up"
  | "at-risk"
  | "new";
export type PatientDirectoryClinicalStatus =
  | "on-track"
  | "follow-up"
  | "urgent"
  | "expiring-plan"
  | "new";
export type PatientDirectorySort =
  | "clinical-priority"
  | "name"
  | "next-appointment"
  | "goal-progress"
  | "last-consultation";

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
  clinicalSegment: PatientDirectoryClinicalSegment;
  sort: PatientDirectorySort;
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
  nextAppointmentStatus: string | null;
  hasPendingBalance: boolean;
  pendingBalance: number;
  activePlanName: string | null;
  activePlanKcal: number | null;
  activePlanStartAt: string | null;
  activePlanEndAt: string | null;
  activePlanProgress: number | null;
  goalLabel: string | null;
  goalUnit: string | null;
  goalInitialValue: number | null;
  goalTargetValue: number | null;
  goalCurrentValue: number | null;
  goalProgress: number | null;
  lastConsultationAt: string | null;
  daysSinceLastConsultation: number | null;
  latestWeightKg: number | null;
  previousWeightKg: number | null;
  clinicalStatus: PatientDirectoryClinicalStatus;
}

export interface PatientDirectoryCounts {
  total: number;
  active: number;
  inactive: number;
  archived: number;
  deleted: number;
}

export interface PatientDirectoryClinicalCounts {
  all: number;
  onTrack: number;
  followUp: number;
  atRisk: number;
  new: number;
}

export interface PatientDirectoryInsights {
  activeWithPlan: number;
  advancingToGoal: number;
  patientsWithGoal: number;
  appointmentsThisWeek: number;
  requiresContact: number;
  expiringPlans: number;
}

export interface PatientDirectoryResult {
  items: PatientDirectoryItem[];
  filteredTotal: number;
  counts: PatientDirectoryCounts;
  clinicalCounts: PatientDirectoryClinicalCounts;
  insights: PatientDirectoryInsights;
  priorityItems: PatientDirectoryItem[];
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

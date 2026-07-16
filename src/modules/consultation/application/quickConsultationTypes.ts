export type QuickConsultationAction = "start-now" | "schedule-later";

export interface QuickConsultationPatient {
  id: string;
  fullName: string;
  recordNumber: string;
  phone: string | null;
  email: string | null;
  photoUrl: string | null;
  initials: string;
  updatedAt: string;
}

export interface PatientClinicalSummaryAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  message: string;
}

export interface PatientClinicalSummary {
  latestConsultation: {
    id: string;
    date: string;
    reason: string;
  } | null;
  activeGoal: {
    id: string;
    label: string;
    targetDate: string;
  } | null;
  activePlan: {
    id: string;
    name: string;
    startDate: string;
  } | null;
  alerts: PatientClinicalSummaryAlert[];
  financial: {
    pendingCount: number;
    pendingAmount: number;
  } | null;
  followUp: {
    scheduledDate: string | null;
    scheduledTime: string | null;
    recommendedDate: string | null;
  };
}

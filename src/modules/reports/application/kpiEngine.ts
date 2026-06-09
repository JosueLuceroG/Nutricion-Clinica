import type { ConsultationRow } from "@modules/consultation/infrastructure/consultationMapper";
import type { AdherenceIndexRow } from "@modules/adherence/infrastructure/adherenceMapper";
import type { PatientRow } from "@modules/patient/infrastructure/patientMapper";

export function calculateConsultationsPerWeek(consultations: ConsultationRow[]): number {
  if (consultations.length === 0) return 0;
  const dates = consultations
    .map((c) => new Date(c.consultation_date))
    .filter((d) => !isNaN(d.getTime()));
  if (dates.length === 0) return 0;
  const min = Math.min(...dates.map((d) => d.getTime()));
  const max = Math.max(...dates.map((d) => d.getTime()));
  const weeks = Math.max((max - min) / (7 * 24 * 60 * 60 * 1000), 1);
  return Math.round((dates.length / weeks) * 100) / 100;
}

export function calculateAverageAdherence(adherenceIndexes: AdherenceIndexRow[]): number {
  if (adherenceIndexes.length === 0) return 0;
  const sum = adherenceIndexes.reduce((acc, r) => acc + r.score_global, 0);
  return Math.round((sum / adherenceIndexes.length) * 100) / 100;
}

export function calculatePathologyDistribution(patients: PatientRow[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  for (const p of patients) {
    const tags = p.clinical_tags ? p.clinical_tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
    for (const tag of tags) {
      distribution[tag] = (distribution[tag] ?? 0) + 1;
    }
  }
  return distribution;
}

export function calculateActivePatientCount(patients: PatientRow[]): number {
  return patients.filter((p) => p.status === "active").length;
}

export function calculateConsultationsThisMonth(consultations: ConsultationRow[]): number {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return consultations.filter((c) => {
    const d = new Date(c.consultation_date);
    return d >= startOfMonth && d <= endOfMonth;
  }).length;
}

export function calculatePendingPayments(consultations: ConsultationRow[]): number {
  return consultations.filter((c) => !c.paid).length;
}

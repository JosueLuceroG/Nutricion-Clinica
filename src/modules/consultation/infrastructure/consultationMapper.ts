import { Consultation, type ConsultationProps } from "../domain/Consultation";
import { ConsultationId } from "../domain/ConsultationId";
import type { ConsultationStatus } from "../domain/ConsultationStatus";
import { PatientId } from "@modules/patient/domain/PatientId";
import { AnthropometryId } from "@modules/anthropometry/domain/AnthropometryId";
import { LabPanelId } from "@modules/laboratory/domain/LabPanelId";
import { Vitals } from "../domain/Vitals";
import { safeDate, toIsoStringSafe } from "@services/db/safeDate";

export interface ConsultationRow {
  id: string;
  patient_id: string;
  consultation_date: string;
  consultation_number: number;
  reason: string;
  subjective: string | null;
  objective: string | null;
  vitals_json: string | null;
  assessment: string | null;
  plan: string | null;
  anthropometry_id: string | null;
  lab_panel_id: string | null;
  next_visit_date: string | null;
  status: ConsultationStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const consultationRowToDomain = (row: ConsultationRow): Consultation => {
  const props: ConsultationProps = {
    id: ConsultationId.fromUnsafe(row.id),
    patientId: PatientId.fromUnsafe(row.patient_id),
    consultationDate: safeDate(row.consultation_date, undefined, "consultation.consultation_date")!,
    consultationNumber: row.consultation_number,
    reason: row.reason,
    subjective: row.subjective,
    objective: row.objective,
    vitals: Vitals.fromJSON(row.vitals_json ? JSON.parse(row.vitals_json) : null),
    assessment: row.assessment,
    plan: row.plan,
    anthropometryId: row.anthropometry_id ? AnthropometryId.fromUnsafe(row.anthropometry_id) : null,
    labPanelId: row.lab_panel_id ? LabPanelId.fromUnsafe(row.lab_panel_id) : null,
    nextVisitDate: safeDate(row.next_visit_date, null, "consultation.next_visit_date"),
    status: row.status,
    createdAt: safeDate(row.created_at, undefined, "consultation.created_at")!,
    updatedAt: safeDate(row.updated_at, undefined, "consultation.updated_at")!,
    deletedAt: safeDate(row.deleted_at, null, "consultation.deleted_at"),
  };
  return Consultation.reconstitute(props);
};

export const consultationDomainToRow = (c: Consultation): ConsultationRow => {
  return {
    id: c.id.toString(),
    patient_id: c.patientId.toString(),
    consultation_date: toIsoStringSafe(c.consultationDate, new Date().toISOString(), "consultation.consultation_date")!,
    consultation_number: c.consultationNumber,
    reason: c.reason,
    subjective: c.subjective,
    objective: c.objective,
    vitals_json: c.vitals.isEmpty ? null : JSON.stringify(c.vitals.toJSON()),
    assessment: c.assessment,
    plan: c.plan,
    anthropometry_id: c.anthropometryId?.toString() ?? null,
    lab_panel_id: c.labPanelId?.toString() ?? null,
    next_visit_date: toIsoStringSafe(c.nextVisitDate, null, "consultation.next_visit_date"),
    status: c.status,
    created_at: toIsoStringSafe(c.createdAt, new Date().toISOString(), "consultation.created_at")!,
    updated_at: toIsoStringSafe(c.updatedAt, new Date().toISOString(), "consultation.updated_at")!,
    deleted_at: toIsoStringSafe(c.deletedAt, null, "consultation.deleted_at"),
  };
};

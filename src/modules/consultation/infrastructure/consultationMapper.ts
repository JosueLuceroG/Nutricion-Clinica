import { Consultation, type ConsultationProps } from "../domain/Consultation";
import { ConsultationId } from "../domain/ConsultationId";
import type { ConsultationStatus } from "../domain/ConsultationStatus";
import { PatientId } from "@modules/patient/domain/PatientId";
import { AnthropometryId } from "@modules/anthropometry/domain/AnthropometryId";
import { LabPanelId } from "@modules/laboratory/domain/LabPanelId";

export interface ConsultationRow {
  id: string;
  patient_id: string;
  consultation_date: string;
  consultation_number: number;
  reason: string;
  subjective: string | null;
  objective: string | null;
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
    consultationDate: new Date(row.consultation_date),
    consultationNumber: row.consultation_number,
    reason: row.reason,
    subjective: row.subjective,
    objective: row.objective,
    assessment: row.assessment,
    plan: row.plan,
    anthropometryId: row.anthropometry_id ? AnthropometryId.fromUnsafe(row.anthropometry_id) : null,
    labPanelId: row.lab_panel_id ? LabPanelId.fromUnsafe(row.lab_panel_id) : null,
    nextVisitDate: row.next_visit_date ? new Date(row.next_visit_date) : null,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  };
  return Consultation.reconstitute(props);
};

export const consultationDomainToRow = (c: Consultation): ConsultationRow => {
  return {
    id: c.id.toString(),
    patient_id: c.patientId.toString(),
    consultation_date: c.consultationDate.toISOString(),
    consultation_number: c.consultationNumber,
    reason: c.reason,
    subjective: c.subjective,
    objective: c.objective,
    assessment: c.assessment,
    plan: c.plan,
    anthropometry_id: c.anthropometryId?.toString() ?? null,
    lab_panel_id: c.labPanelId?.toString() ?? null,
    next_visit_date: c.nextVisitDate ? c.nextVisitDate.toISOString() : null,
    status: c.status,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
    deleted_at: c.deletedAt ? c.deletedAt.toISOString() : null,
  };
};

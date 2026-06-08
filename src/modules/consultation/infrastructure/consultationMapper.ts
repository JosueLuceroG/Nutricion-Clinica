import { Consultation, type ConsultationProps } from "../domain/Consultation";
import { ConsultationId } from "../domain/ConsultationId";
import type { ConsultationStatus } from "../domain/ConsultationStatus";
import type { PaymentMethod } from "../domain/PaymentMethod";
import { isPaymentMethod } from "../domain/PaymentMethod";
import { PatientId } from "@modules/patient/domain/PatientId";
import { AnthropometryId } from "@modules/anthropometry/domain/AnthropometryId";
import { LabPanelId } from "@modules/laboratory/domain/LabPanelId";
import { Vitals } from "../domain/Vitals";
import { safeDate, toIsoStringSafe, safeJsonParse } from "@services/db/safeDate";

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
  cost: number;
  paid: boolean;
  payment_method: string | null;
  paid_at: string | null;
  reference: string | null;
  invoice_number: string | null;
  billing_notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const consultationRowToDomain = (row: ConsultationRow): Consultation => {
  const paymentMethod: PaymentMethod | null = isPaymentMethod(row.payment_method)
    ? row.payment_method
    : null;
  const props: ConsultationProps = {
    id: ConsultationId.fromUnsafe(row.id),
    patientId: PatientId.fromUnsafe(row.patient_id),
    consultationDate: safeDate(row.consultation_date, undefined, "consultation.consultation_date")!,
    consultationNumber: row.consultation_number,
    reason: row.reason,
    subjective: row.subjective,
    objective: row.objective,
    vitals: Vitals.fromJSON(safeJsonParse(row.vitals_json, null)),
    assessment: row.assessment,
    plan: row.plan,
    anthropometryId: row.anthropometry_id ? AnthropometryId.fromUnsafe(row.anthropometry_id) : null,
    labPanelId: row.lab_panel_id ? LabPanelId.fromUnsafe(row.lab_panel_id) : null,
    nextVisitDate: safeDate(row.next_visit_date, null, "consultation.next_visit_date"),
    status: row.status,
    cost: typeof row.cost === "number" && Number.isFinite(row.cost) ? row.cost : 0,
    paid: Boolean(row.paid),
    paymentMethod,
    paidAt: safeDate(row.paid_at, null, "consultation.paid_at"),
    reference: row.reference ?? null,
    invoiceNumber: row.invoice_number ?? null,
    billingNotes: row.billing_notes ?? null,
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
    cost: c.cost,
    paid: c.paid,
    payment_method: c.paymentMethod,
    paid_at: toIsoStringSafe(c.paidAt, null, "consultation.paid_at"),
    reference: c.reference,
    invoice_number: c.invoiceNumber,
    billing_notes: c.billingNotes,
    created_at: toIsoStringSafe(c.createdAt, new Date().toISOString(), "consultation.created_at")!,
    updated_at: toIsoStringSafe(c.updatedAt, new Date().toISOString(), "consultation.updated_at")!,
    deleted_at: toIsoStringSafe(c.deletedAt, null, "consultation.deleted_at"),
  };
};

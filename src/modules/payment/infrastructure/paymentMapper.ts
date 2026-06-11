import { Payment, type PaymentProps } from "../domain/Payment";
import { PaymentId } from "../domain/PaymentId";
import { isPaymentStatus } from "@modules/consultation/domain/PaymentStatus";
import { isPaymentConcept } from "@modules/consultation/domain/PaymentConcept";
import { isPaymentMethod } from "@modules/consultation/domain/PaymentMethod";
import { safeDate, toIsoStringSafe } from "@services/db/safeDate";

export interface PaymentRow {
  id: string;
  paciente_id: string;
  consultation_id: string | null;
  appointment_id: string | null;
  meal_plan_id: string | null;
  concept: string;
  amount: number;
  currency: string;
  method: string | null;
  status: string;
  paid_at: string | null;
  reference: string | null;
  invoice_number: string | null;
  invoice_xml: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const paymentRowToDomain = (row: PaymentRow): Payment => {
  const props: PaymentProps = {
    id: PaymentId.fromUnsafe(row.id),
    pacienteId: row.paciente_id,
    consultationId: row.consultation_id,
    appointmentId: row.appointment_id,
    mealPlanId: row.meal_plan_id,
    concept: isPaymentConcept(row.concept) ? row.concept : "consulta",
    amount: typeof row.amount === "number" && Number.isFinite(row.amount) ? row.amount : 0,
    currency: row.currency ?? "MXN",
    method: isPaymentMethod(row.method) ? row.method : null,
    status: isPaymentStatus(row.status) ? row.status : "pending",
    paidAt: safeDate(row.paid_at, null),
    reference: row.reference,
    invoiceNumber: row.invoice_number,
    invoiceXml: row.invoice_xml,
    notes: row.notes,
    createdAt: safeDate(row.created_at, undefined)!,
    updatedAt: safeDate(row.updated_at, undefined)!,
    deletedAt: safeDate(row.deleted_at, null),
  };
  return Payment.reconstitute(props);
};

export const paymentDomainToRow = (p: Payment): PaymentRow => {
  return {
    id: p.id.toString(),
    paciente_id: p.pacienteId,
    consultation_id: p.consultationId,
    appointment_id: p.appointmentId,
    meal_plan_id: p.mealPlanId,
    concept: p.concept,
    amount: p.amount,
    currency: p.currency,
    method: p.method,
    status: p.status,
    paid_at: toIsoStringSafe(p.paidAt, null),
    reference: p.reference,
    invoice_number: p.invoiceNumber,
    invoice_xml: p.invoiceXml,
    notes: p.notes,
    created_at: toIsoStringSafe(p.createdAt, new Date().toISOString())!,
    updated_at: toIsoStringSafe(p.updatedAt, new Date().toISOString())!,
    deleted_at: toIsoStringSafe(p.deletedAt, null),
  };
};

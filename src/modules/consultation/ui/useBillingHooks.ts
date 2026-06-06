import { useLiveQuery } from "dexie-react-hooks";
import { db as defaultDb, type NutriClinicaDB } from "@services/db/dexieSchema";
import { consultationRowToDomain } from "@modules/consultation/infrastructure/consultationMapper";
import { PatientId } from "@modules/patient/domain/PatientId";
import type { Consultation } from "@modules/consultation/domain/Consultation";
import { consultationService } from "@services/consultationService";
import type { RegisterPaymentInput } from "@modules/consultation/application/consultationUseCases";
import { patientService } from "@services/patientService";

export interface PendingPaymentItem {
  consultation: Consultation;
  patientName: string;
  patientId: string;
}

export interface PendingPaymentsFilters {
  from?: Date;
  to?: Date;
  patientQuery?: string;
}

const matchPatient = (fullName: string, query: string): boolean => {
  if (!query) return true;
  const q = query.toLowerCase();
  return fullName.toLowerCase().includes(q);
};

/**
 * Lista de consultas con pago pendiente (paid=false y cost>0).
 *
 * Reactividad: usa `useLiveQuery` para reflejar cambios de Dexie en
 * tiempo real (marcar como pagada, costo nuevo, soft-delete, etc.).
 *
 * Acepta un `db` opcional (útil para tests con DB aislada). En la app
 * real se usa el singleton `db` global.
 */
export const usePendingPayments = (
  filters: PendingPaymentsFilters = {},
  dbInstance: NutriClinicaDB = defaultDb,
) => {
  const { from, to, patientQuery = "" } = filters;

  const result = useLiveQuery(
    async (): Promise<{ items: PendingPaymentItem[]; total: number; totalAmount: number }> => {
      const fromMs = from?.getTime() ?? 0;
      const toMs = to?.getTime() ?? Number.MAX_SAFE_INTEGER;

      const rows = await dbInstance.consultations
        .filter((r) => {
          if (r.deleted_at) return false;
          if (r.paid) return false;
          if (!(r.cost > 0)) return false;
          const t = new Date(r.consultation_date).getTime();
          if (t < fromMs || t > toMs) return false;
          return true;
        })
        .toArray();

      const patientIds = Array.from(new Set(rows.map((r) => r.patient_id)));
      const patientRows = patientIds.length
        ? await dbInstance.patients.where("id").anyOf(patientIds).toArray()
        : [];
      const patientNameById = new Map(patientRows.map((p) => [p.id, `${p.first_name} ${p.last_name}`]));

      const items: PendingPaymentItem[] = rows
        .map((r) => {
          const consultation = consultationRowToDomain(r);
          const patientName = patientNameById.get(r.patient_id) ?? "(sin nombre)";
          return { consultation, patientName, patientId: r.patient_id };
        })
        .filter((it) => matchPatient(it.patientName, patientQuery))
        .sort((a, b) => b.consultation.consultationDate.getTime() - a.consultation.consultationDate.getTime());

      const totalAmount = items.reduce((sum, it) => sum + it.consultation.cost, 0);
      return { items, total: items.length, totalAmount };
    },
    [dbInstance, from?.getTime(), to?.getTime(), patientQuery],
    { items: [] as PendingPaymentItem[], total: 0, totalAmount: 0 },
  );

  return {
    items: result.items,
    total: result.total,
    totalAmount: result.totalAmount,
    registerPayment: (consultation: Consultation, input: RegisterPaymentInput) =>
      consultationService.payment.register(consultation.id, input),
  };
};

/**
 * Carga un Consultation por ID como live query (refleja cambios).
 */
export const useConsultationLive = (
  id: string | null,
  dbInstance: NutriClinicaDB = defaultDb,
) =>
  useLiveQuery(
    async (): Promise<Consultation | null> => {
      if (!id) return null;
      const row = await dbInstance.consultations.get(id);
      if (!row) return null;
      return consultationRowToDomain(row);
    },
    [dbInstance, id],
    null,
  );

/**
 * Carga un Patient como live query.
 */
export const usePatientLive = (id: string | null) => {
  return useLiveQuery(
    async () => {
      if (!id) return null;
      try {
        return await patientService.get.execute(PatientId.fromUnsafe(id));
      } catch {
        return null;
      }
    },
    [id],
    null,
  );
};

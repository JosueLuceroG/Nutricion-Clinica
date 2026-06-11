import { useLiveQuery } from "dexie-react-hooks";
import { db as defaultDb, type NutriClinicaDB } from "@services/db/dexieSchema";
import { paymentRowToDomain } from "../infrastructure/paymentMapper";
import type { PaymentStatus } from "@modules/consultation/domain/PaymentStatus";

export interface PaymentFilters {
  pacienteId?: string;
  status?: PaymentStatus;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export const usePayments = (
  filters: PaymentFilters = {},
  dbInstance: NutriClinicaDB = defaultDb,
) => {
  const { pacienteId, status, from, to, limit } = filters;

  const items = useLiveQuery(
    async () => {
      let collection = dbInstance.payments.toCollection();

      if (pacienteId) {
        collection = dbInstance.payments
          .where("patient_id")
          .equals(pacienteId);
      }

      let rows = await collection.toArray();

      if (status) {
        rows = rows.filter((r) => r.status === status);
      }
      if (from) {
        const fromMs = from.getTime();
        rows = rows.filter((r) => {
          const d = new Date(r.paid_at ?? r.created_at).getTime();
          return d >= fromMs;
        });
      }
      if (to) {
        const toMs = to.getTime();
        rows = rows.filter((r) => {
          const d = new Date(r.paid_at ?? r.created_at).getTime();
          return d <= toMs;
        });
      }

      rows.sort((a, b) => {
        const da = new Date(a.paid_at ?? a.created_at).getTime();
        const db_ = new Date(b.paid_at ?? b.created_at).getTime();
        return db_ - da;
      });

      if (limit) {
        rows = rows.slice(0, limit);
      }

      return rows.map(paymentRowToDomain);
    },
    [dbInstance, pacienteId, status, from?.getTime(), to?.getTime(), limit],
    [],
  );

  return items;
};

export const usePayment = (
  id: string | null,
  dbInstance: NutriClinicaDB = defaultDb,
) =>
  useLiveQuery(
    async () => {
      if (!id) return null;
      const row = await dbInstance.payments.get(id);
      if (!row) return null;
      return paymentRowToDomain(row);
    },
    [dbInstance, id],
    null,
  );

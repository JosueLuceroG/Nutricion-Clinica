import { useLiveQuery } from "dexie-react-hooks";
import { db as defaultDb, type NutriClinicaDB } from "@services/db/dexieSchema";
import { consultationRowToDomain } from "@modules/consultation/infrastructure/consultationMapper";

export interface MonthlyBucket {
  /** YYYY-MM */
  monthKey: string;
  /** Etiqueta localizada: "Jun 2026" */
  label: string;
  income: number;
  pending: number;
  paidCount: number;
  pendingCount: number;
}

export interface PatientTopRow {
  patientId: string;
  patientName: string;
  consultations: number;
  totalPaid: number;
}

export interface FinancialReport {
  rangeStart: Date;
  rangeEnd: Date;
  totalIncome: number;
  totalPending: number;
  paidCount: number;
  pendingCount: number;
  /** # pacientes distintos con al menos 1 consulta en el rango */
  activePatients: number;
  monthly: MonthlyBucket[];
  topPatients: PatientTopRow[];
}

const MONTH_LABELS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const monthKeyOf = (d: Date): string => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const labelOf = (key: string): string => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_LABELS[(m ?? 1) - 1]} ${y}`;
};

const monthRange = (end: Date, count: number): string[] => {
  const keys: string[] = [];
  const base = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCMonth(base.getUTCMonth() - i);
    keys.push(monthKeyOf(d));
  }
  return keys;
};

/**
 * Reporte financiero para una ventana de tiempo. Por default: últimos 6 meses.
 *
 * Agrega:
 *  - totalIncome / totalPending (en MXN, suma de cost)
 *  - paidCount / pendingCount (# de consultas)
 *  - activePatients (distinct patient_id)
 *  - monthly: buckets de los últimos N meses
 *  - topPatients: top 5 por totalPaid
 */
export const useFinancialReport = (
  rangeDays = 180,
  months = 6,
  topN = 5,
  dbInstance: NutriClinicaDB = defaultDb,
): FinancialReport | null => {
  return useLiveQuery<FinancialReport | null, FinancialReport | null>(
    async () => {
      const now = new Date();
      const rangeEnd = new Date(now);
      const rangeStart = new Date(now);
      rangeStart.setDate(rangeStart.getDate() - rangeDays);

      const fromMs = rangeStart.getTime();
      const toMs = rangeEnd.getTime();

      const rows = await dbInstance.consultations
        .filter((r) => {
          if (r.deleted_at) return false;
          const t = new Date(r.consultation_date).getTime();
          if (t < fromMs || t > toMs) return false;
          if (!(r.cost > 0)) return false;
          return true;
        })
        .toArray();

      const months6 = monthRange(now, months);
      const monthlyMap = new Map<string, MonthlyBucket>();
      for (const k of months6) {
        monthlyMap.set(k, {
          monthKey: k,
          label: labelOf(k),
          income: 0,
          pending: 0,
          paidCount: 0,
          pendingCount: 0,
        });
      }

      let totalIncome = 0;
      let totalPending = 0;
      let paidCount = 0;
      let pendingCount = 0;
      const patientTotals = new Map<string, { name: string; consultations: number; totalPaid: number }>();
      const patientActive = new Set<string>();

      for (const row of rows) {
        const c = consultationRowToDomain(row);
        const key = monthKeyOf(c.consultationDate);
        const bucket = monthlyMap.get(key);
        if (c.paid) {
          totalIncome += c.cost;
          paidCount += 1;
          if (bucket) {
            bucket.income += c.cost;
            bucket.paidCount += 1;
          }
          const cur = patientTotals.get(c.patientId.toString()) ?? {
            name: "",
            consultations: 0,
            totalPaid: 0,
          };
          cur.consultations += 1;
          cur.totalPaid += c.cost;
          patientTotals.set(c.patientId.toString(), cur);
        } else {
          totalPending += c.cost;
          pendingCount += 1;
          if (bucket) {
            bucket.pending += c.cost;
            bucket.pendingCount += 1;
          }
        }
        patientActive.add(c.patientId.toString());
      }

      const patientIds = Array.from(patientTotals.keys());
      const patientRows = patientIds.length
        ? await dbInstance.patients.where("id").anyOf(patientIds).toArray()
        : [];
      const nameById = new Map(patientRows.map((p) => [p.id, `${p.first_name} ${p.last_name}`]));
      const topPatients: PatientTopRow[] = Array.from(patientTotals.entries())
        .map(([patientId, v]) => ({
          patientId,
          patientName: nameById.get(patientId) ?? v.name,
          consultations: v.consultations,
          totalPaid: v.totalPaid,
        }))
        .sort((a, b) => b.totalPaid - a.totalPaid)
        .slice(0, topN);

      const result: FinancialReport = {
        rangeStart,
        rangeEnd,
        totalIncome,
        totalPending,
        paidCount,
        pendingCount,
        activePatients: patientActive.size,
        monthly: months6.map((k) => monthlyMap.get(k)!),
        topPatients,
      };
      return result;
    },
    [dbInstance, rangeDays, months, topN],
    null,
  );
};

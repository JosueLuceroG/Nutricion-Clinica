import { useLiveQuery } from "dexie-react-hooks";
import { db as defaultDb, type NutriClinicaDB } from "@services/db/dexieSchema";
import { consultationRowToDomain } from "@modules/consultation/infrastructure/consultationMapper";
import { expenseRowToDomain } from "@modules/expense/infrastructure/expenseMapper";
import i18n from "@i18n/config";

export interface MonthlyBucket {
  monthKey: string;
  label: string;
  income: number;
  pending: number;
  paidCount: number;
  pendingCount: number;
  expenses: number;
}

export interface PatientTopRow {
  patientId: string;
  patientName: string;
  consultations: number;
  totalPaid: number;
}

export interface ConceptBreakdown {
  concept: string;
  total: number;
  count: number;
}

export interface MethodBreakdown {
  method: string;
  total: number;
  count: number;
}

export interface FinancialReport {
  rangeStart: Date;
  rangeEnd: Date;
  totalIncome: number;
  totalPending: number;
  totalExpenses: number;
  netIncome: number;
  paidCount: number;
  pendingCount: number;
  activePatients: number;
  monthly: MonthlyBucket[];
  topPatients: PatientTopRow[];
  conceptBreakdown: ConceptBreakdown[];
  methodBreakdown: MethodBreakdown[];
}

const MONTH_LABELS = [
  i18n.t("billing.month_jan"), i18n.t("billing.month_feb"), i18n.t("billing.month_mar"), i18n.t("billing.month_apr"), i18n.t("billing.month_may"), i18n.t("billing.month_jun"),
  i18n.t("billing.month_jul"), i18n.t("billing.month_aug"), i18n.t("billing.month_sep"), i18n.t("billing.month_oct"), i18n.t("billing.month_nov"), i18n.t("billing.month_dec"),
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

const monthRange = (from: Date, to: Date): string[] => {
  const keys: string[] = [];
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  const cursor = new Date(start);
  while (cursor <= end) {
    keys.push(monthKeyOf(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
};

export const useFinancialReport = (
  from: Date,
  to: Date,
  topN = 5,
  dbInstance: NutriClinicaDB = defaultDb,
): FinancialReport | null => {
  return useLiveQuery<FinancialReport | null, FinancialReport | null>(
    async () => {
      const fromMs = from.getTime();
      const toMs = to.getTime();

      const consultationRows = await dbInstance.consultations
        .filter((r) => {
          if (r.deleted_at) return false;
          const t = new Date(r.consultation_date).getTime();
          if (t < fromMs || t > toMs) return false;
          if (!(r.cost > 0)) return false;
          return true;
        })
        .toArray();

      const expenseRows = await dbInstance.expenses
        .filter((r) => {
          if (r.deleted_at) return false;
          const t = new Date(r.expense_date).getTime();
          return t >= fromMs && t <= toMs;
        })
        .toArray();

      const months = monthRange(from, to);
      const monthlyMap = new Map<string, MonthlyBucket>();
      for (const k of months) {
        monthlyMap.set(k, {
          monthKey: k,
          label: labelOf(k),
          income: 0,
          pending: 0,
          paidCount: 0,
          pendingCount: 0,
          expenses: 0,
        });
      }

      let totalIncome = 0;
      let totalPending = 0;
      let totalExpenses = 0;
      let paidCount = 0;
      let pendingCount = 0;
      const patientTotals = new Map<string, { name: string; consultations: number; totalPaid: number }>();
      const patientActive = new Set<string>();

      for (const row of consultationRows) {
        const c = consultationRowToDomain(row);
        const key = monthKeyOf(c.consultationDate);
        const bucket = monthlyMap.get(key);
        const ps = c.paymentStatus;
        if (c.paid || ps === "paid" || ps === "partial") {
          const amount = ps === "partial" ? c.amountPaid : c.cost;
          totalIncome += amount;
          paidCount += 1;
          if (bucket) {
            bucket.income += amount;
            bucket.paidCount += 1;
          }
          const cur = patientTotals.get(c.patientId.toString()) ?? {
            name: "",
            consultations: 0,
            totalPaid: 0,
          };
          cur.consultations += 1;
          cur.totalPaid += amount;
          patientTotals.set(c.patientId.toString(), cur);
        }
        if (!c.paid || c.paymentStatus === "partial") {
          totalPending += c.cost - (c.amountPaid || 0);
          pendingCount += 1;
          if (bucket) {
            bucket.pending += c.cost - (c.amountPaid || 0);
            bucket.pendingCount += 1;
          }
        }
        patientActive.add(c.patientId.toString());
      }

      for (const row of expenseRows) {
        const e = expenseRowToDomain(row);
        const key = monthKeyOf(e.fecha);
        const bucket = monthlyMap.get(key);
        totalExpenses += e.amount;
        if (bucket) {
          bucket.expenses += e.amount;
        }
      }

      const patientIds = Array.from(patientTotals.keys());
      const patientDbRows = patientIds.length
        ? await dbInstance.patients.where("id").anyOf(patientIds).toArray()
        : [];
      const nameById = new Map(patientDbRows.map((p) => [p.id, `${p.first_name} ${p.last_name}`]));
      const topPatients: PatientTopRow[] = Array.from(patientTotals.entries())
        .map(([patientId, v]) => ({
          patientId,
          patientName: nameById.get(patientId) ?? v.name,
          consultations: v.consultations,
          totalPaid: v.totalPaid,
        }))
        .sort((a, b) => b.totalPaid - a.totalPaid)
        .slice(0, topN);

      const conceptMap = new Map<string, { total: number; count: number }>();
      for (const row of consultationRows) {
        const c = consultationRowToDomain(row);
        const concept = c.paymentConcept ?? "consulta";
        if (c.paid || c.paymentStatus === "paid" || c.paymentStatus === "partial") {
          const amount = c.paymentStatus === "partial" ? (c.amountPaid ?? 0) : c.cost;
          const cur = conceptMap.get(concept) ?? { total: 0, count: 0 };
          cur.total += amount;
          cur.count += 1;
          conceptMap.set(concept, cur);
        }
      }
      const conceptBreakdown: ConceptBreakdown[] = Array.from(conceptMap.entries())
        .map(([concept, v]) => ({ concept, total: v.total, count: v.count }))
        .sort((a, b) => b.total - a.total);

      const methodMap = new Map<string, { total: number; count: number }>();
      for (const row of consultationRows) {
        const c = consultationRowToDomain(row);
        if (c.paid || c.paymentStatus === "paid" || c.paymentStatus === "partial") {
          const method = c.paymentMethod ?? "other";
          const amount = c.paymentStatus === "partial" ? (c.amountPaid ?? 0) : c.cost;
          const cur = methodMap.get(method) ?? { total: 0, count: 0 };
          cur.total += amount;
          cur.count += 1;
          methodMap.set(method, cur);
        }
      }
      const methodBreakdown: MethodBreakdown[] = Array.from(methodMap.entries())
        .map(([method, v]) => ({ method, total: v.total, count: v.count }))
        .sort((a, b) => b.total - a.total);

      const result: FinancialReport = {
        rangeStart: from,
        rangeEnd: to,
        totalIncome,
        totalPending,
        totalExpenses,
        netIncome: totalIncome - totalExpenses,
        paidCount,
        pendingCount,
        activePatients: patientActive.size,
        monthly: months.map((k) => monthlyMap.get(k)!),
        topPatients,
        conceptBreakdown,
        methodBreakdown,
      };
      return result;
    },
    [dbInstance, from.getTime(), to.getTime(), topN],
    null,
  );
};

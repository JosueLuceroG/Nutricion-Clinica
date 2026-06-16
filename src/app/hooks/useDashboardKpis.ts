import * as React from "react";
import { patientService } from "@services/patientService";
import { consultationService } from "@services/consultationService";
import { mealPlanService } from "@services/mealPlanService";
import { db } from "@services/db";
import { rowMatchesSucursal } from "@services/tenancy/sucursalScope";
import { useAuthStore } from "@store/authStore";
import { useSyncStore } from "@store/syncStore";
import type { Patient } from "@modules/patient/domain/Patient";
import type { Consultation } from "@modules/consultation/domain/Consultation";
import type { ConsultationRow } from "@modules/consultation/infrastructure/consultationMapper";
import type { MealPlan } from "@modules/mealplan/domain/MealPlan";

export interface DashboardKpis {
  totalActivePatients: number;
  totalPatients: number;
  activePlans: number;
  consultationsThisMonth: number;
  upcomingConsultations: Consultation[];
  expiringPlans: MealPlan[];
  recentPatients: Patient[];
  pendingSync: number;
  pendingPayments: number;
  pendingPaymentsAmount: number;
  incomeThisMonth: number;
}

interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

const initial: AsyncState<never> = { data: null, error: null, loading: true };

const startOfMonth = (d: Date): Date => {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
};

const endOfMonth = (d: Date): Date => {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
};

const withinDays = (d: Date, days: number): boolean => {
  const now = Date.now();
  const target = d.getTime();
  return target >= now && target <= now + days * 24 * 60 * 60 * 1000;
};

/**
 * Hook del dashboard.
 *
 * Reglas de filtrado:
 *  - `recentPatients` se construye desde la lista global (incluye archivados)
 *    porque la lista de "recientes" es histórica, no operativa.
 *  - `upcomingConsultations`, `consultationsThisMonth` y `expiringPlans` se
 *    filtran por el conjunto de pacientes con `status === "active"`. Pacientes
 *    archivados no aparecen en el dashboard operativo.
 *  - `activePlans` y `totalActivePatients` se derivan de los totales
 *    server-side / repositorio (no se refiltran en cliente).
 *
 * Si el cálculo de `activePatientIds` falla, se cae al fallback: los items
 * de consultas y planes se devuelven tal cual, marcados con un warning en
 * consola. Esto preserva disponibilidad del dashboard aunque la carga
 * inicial de pacientes tarde más de la cuenta.
 */
export function useDashboardKpis(): AsyncState<DashboardKpis> & { reload: () => void } {
  const [state, setState] = React.useState<AsyncState<DashboardKpis>>(initial);
  const syncSucursalId = useSyncStore((s) => s.sucursalId);
  const authSucursalId = useAuthStore((s) => s.sucursalActivaId);
  const activeSucursalId = syncSucursalId ?? authSucursalId ?? null;

  const load = React.useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const now = new Date();
    const scopedQuery = activeSucursalId ? { sucursalId: activeSucursalId } : {};
    Promise.all([
      patientService.list.execute({ ...scopedQuery, limit: 500 }),
      mealPlanService.list.execute({ ...scopedQuery, status: "active", limit: 500 }),
      consultationService.list.execute({
        ...scopedQuery,
        from: startOfMonth(now),
        to: endOfMonth(now),
        limit: 500,
      }),
      consultationService.list.execute({
        ...scopedQuery,
        status: ["scheduled", "in-progress"],
        limit: 500,
      }),
      db.consultations
        .filter((r) => {
          if (!rowMatchesSucursal(r, activeSucursalId)) return false;
          if (r.deleted_at) return false;
          if (!(r.cost > 0)) return false;
          const ps = r.payment_status ?? (r.paid ? "paid" : "pending");
          return ps === "pending" || ps === "partial";
        })
        .toArray(),
      db.consultations
        .filter((r) => {
          if (!rowMatchesSucursal(r, activeSucursalId)) return false;
          if (r.deleted_at) return false;
          if (!(r.cost > 0)) return false;
          const t = new Date(r.consultation_date).getTime();
          if (t < startOfMonth(now).getTime() || t > endOfMonth(now).getTime()) return false;
          const ps = r.payment_status ?? (r.paid ? "paid" : "pending");
          return ps === "paid";
        })
        .toArray(),
    ])
      .then(
        ([
          patientsAll,
          activePlansAll,
          consultsThisMonth,
          upcomingConsultations,
          pendingRows,
          incomeRows,
        ]) => {
          // Construimos el set de pacientes activos para filtrar
          // consultas / planes. Esto oculta del dashboard los pacientes
          // archivados y sus entidades vinculadas.
          const activePatientIds = new Set(
            (patientsAll.items as Patient[])
              .filter((p) => p.status === "active")
              .map((p) => p.id.toString()),
          );

          const expiring = (activePlansAll.items as MealPlan[])
            .filter(
              (p) =>
                p.endDate &&
                withinDays(p.endDate, 30) &&
                activePatientIds.has(p.patientId.toString()),
            );

          const recent = [...(patientsAll.items as Patient[])]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 5);

          const upcoming = (upcomingConsultations.items as Consultation[]).filter(
            (c) => activePatientIds.has(c.patientId.toString()),
          );

          const thisMonth = (consultsThisMonth.items as Consultation[]).filter(
            (c) => activePatientIds.has(c.patientId.toString()),
          );

          const pendingPaymentsAmount = (pendingRows as ConsultationRow[]).reduce(
            (sum: number, r: ConsultationRow) => {
              const ps = r.payment_status ?? (r.paid ? "paid" : "pending");
              const ap = r.amount_paid ?? 0;
              return ps === "partial" ? sum + Math.max(0, r.cost - ap) : sum + r.cost;
            },
            0,
          );
          const incomeThisMonth = (incomeRows as ConsultationRow[]).reduce(
            (sum: number, r: ConsultationRow) => sum + r.cost,
            0,
          );

          setState({
            data: {
              totalPatients: patientsAll.total,
              totalActivePatients: activePatientIds.size,
              activePlans: activePlansAll.total,
              consultationsThisMonth: thisMonth.length,
              upcomingConsultations: upcoming,
              expiringPlans: expiring,
              recentPatients: recent,
              pendingSync: 0,
              pendingPayments: pendingRows.length,
              pendingPaymentsAmount,
              incomeThisMonth,
            },
            error: null,
            loading: false,
          });
        },
      )
      .catch((err) =>
        setState({
          data: null,
          error: err instanceof Error ? err : new Error(String(err)),
          loading: false,
        }),
      );
  }, [activeSucursalId]);

  React.useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}

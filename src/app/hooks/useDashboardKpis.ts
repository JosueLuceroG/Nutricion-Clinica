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
  consultationsToday: number;
  consultationsThisMonth: number;
  upcomingConsultations: Consultation[];
  patientNamesById: Record<string, string>;
  expiringPlans: MealPlan[];
  recentPatients: Patient[];
  pendingSync: number;
  pendingPayments: number;
  pendingPaymentsAmount: number;
  incomeThisMonth: number;
  recentPayments: DashboardRecentPayment[];
  weeklyActivity: DashboardWeeklyActivityPoint[];
}

export interface DashboardRecentPayment {
  patientName: string;
  concept: string;
  amountPaid: number;
  remainingAmount: number;
  paymentStatus: string;
  paymentMethod: string | null;
  paidAt: Date | null;
  consultationDate: Date;
  updatedAt: Date;
}

export interface DashboardWeeklyActivityPoint {
  day: string;
  consultas: number;
  nuevos: number;
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

const startOfWeek = (d: Date): Date => {
  const mondayOffset = d.getDay() === 0 ? -6 : 1 - d.getDay();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + mondayOffset, 0, 0, 0, 0);
};

const endOfWeek = (d: Date): Date => {
  const start = startOfWeek(d);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
};

const withinDays = (d: Date, days: number): boolean => {
  const now = Date.now();
  const target = d.getTime();
  return target >= now && target <= now + days * 24 * 60 * 60 * 1000;
};

const sameDay = (a: Date, b: Date): boolean => {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
};

const weekDayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const weekDayIndex = (d: Date): number => {
  return (d.getDay() + 6) % 7;
};

const inRange = (d: Date, from: Date, to: Date): boolean => {
  const time = d.getTime();
  return time >= from.getTime() && time <= to.getTime();
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
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
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
        from: weekStart,
        to: weekEnd,
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
      db.consultations
        .filter((r) => {
          if (!rowMatchesSucursal(r, activeSucursalId)) return false;
          if (r.deleted_at) return false;
          if (!(r.cost > 0)) return false;
          const ps = r.payment_status ?? (r.paid ? "paid" : "pending");
          return ps === "paid" || ps === "partial";
        })
        .toArray(),
    ])
      .then(
        ([
          patientsAll,
          activePlansAll,
          consultsThisMonth,
          consultsThisWeek,
          upcomingConsultations,
          pendingRows,
          incomeRows,
          recentPaymentRows,
        ]) => {
          // Construimos el set de pacientes activos para filtrar
          // consultas / planes. Esto oculta del dashboard los pacientes
          // archivados y sus entidades vinculadas.
          const activePatientIds = new Set(
            (patientsAll.items as Patient[])
              .filter((p) => p.status === "active")
              .map((p) => p.id.toString()),
          );
          const patientNamesById = Object.fromEntries(
            (patientsAll.items as Patient[]).map((p) => [p.id.toString(), p.fullName]),
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
          const today = thisMonth.filter((c) => sameDay(c.consultationDate, now));

          const weeklyActivity: DashboardWeeklyActivityPoint[] = weekDayLabels.map((day) => ({
            day,
            consultas: 0,
            nuevos: 0,
          }));
          (consultsThisWeek.items as Consultation[])
            .filter((c) => activePatientIds.has(c.patientId.toString()))
            .forEach((c) => {
              weeklyActivity[weekDayIndex(c.consultationDate)]!.consultas += 1;
            });
          (patientsAll.items as Patient[])
            .filter((p) => p.status === "active" && inRange(p.recordOpenedAt, weekStart, weekEnd))
            .forEach((p) => {
              weeklyActivity[weekDayIndex(p.recordOpenedAt)]!.nuevos += 1;
            });

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
          const recentPayments = (recentPaymentRows as ConsultationRow[])
            .map((r) => {
              const paymentStatus = r.payment_status ?? (r.paid ? "paid" : "pending");
              const amountPaid = r.amount_paid ?? (r.paid ? r.cost : 0);
              return {
                patientName: patientNamesById[r.patient_id] ?? "(sin nombre)",
                concept: r.reason || "Consulta nutricional",
                amountPaid,
                remainingAmount: Math.max(0, r.cost - amountPaid),
                paymentStatus,
                paymentMethod: r.payment_method,
                paidAt: r.paid_at ? new Date(r.paid_at) : null,
                consultationDate: new Date(r.consultation_date),
                updatedAt: new Date(r.updated_at),
              };
            })
            .sort((a, b) => {
              const aTime = (a.paidAt ?? a.updatedAt ?? a.consultationDate).getTime();
              const bTime = (b.paidAt ?? b.updatedAt ?? b.consultationDate).getTime();
              return bTime - aTime;
            })
            .slice(0, 3);

          setState({
            data: {
              totalPatients: patientsAll.total,
              totalActivePatients: activePatientIds.size,
              activePlans: activePlansAll.total,
              consultationsToday: today.length,
              consultationsThisMonth: thisMonth.length,
              upcomingConsultations: upcoming,
              patientNamesById,
              expiringPlans: expiring,
              recentPatients: recent,
              pendingSync: 0,
              pendingPayments: pendingRows.length,
              pendingPaymentsAmount,
              incomeThisMonth,
              recentPayments,
              weeklyActivity,
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

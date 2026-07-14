import * as React from "react";
import { agendaService } from "@services/agendaService";
import { db } from "@services/db";
import { useAuthStore } from "@store/authStore";
import { useSyncStore } from "@store/syncStore";
import type { Patient } from "@modules/patient/domain/Patient";
import type { Consultation } from "@modules/consultation/domain/Consultation";
import { consultationRowToDomain, type ConsultationRow } from "@modules/consultation/infrastructure/consultationMapper";
import type { MealPlan } from "@modules/mealplan/domain/MealPlan";
import type { Appointment } from "@modules/agenda/domain/Appointment";
import { patientRowToDomain } from "@modules/patient/infrastructure/patientMapper";
import { mealPlanRowToDomain } from "@modules/mealplan/infrastructure/mealPlanMapper";
import { BILLING_REPORT_ROLES } from "@modules/auth/authRoles";

export interface DashboardKpis {
  totalActivePatients: number;
  totalPatients: number;
  newPatientsThisMonth: number;
  newPatientsPreviousMonth: number;
  activePlans: number;
  consultationsToday: number;
  scheduledConsultationsToday: number;
  consultationsThisMonth: number;
  upcomingConsultations: Consultation[];
  upcomingAppointments: Appointment[];
  appointmentsToday: Appointment[];
  unconfirmedAppointments: Appointment[];
  patientNamesById: Record<string, string>;
  expiringPlans: MealPlan[];
  recentPatients: Patient[];
  pendingSync: number;
  pendingPayments: number;
  pendingPaymentsAmount: number;
  pendingPaymentsThisMonth: number;
  pendingPaymentsAmountThisMonth: number;
  incomeThisMonth: number;
  incomePreviousMonth: number;
  incomeActivity: number[];
  paymentsThisMonth: number;
  recentPayments: DashboardRecentPayment[];
  weeklyActivity: DashboardWeeklyActivityPoint[];
  monthlyActivity: DashboardWeeklyActivityPoint[];
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

const toDateOnly = (d: Date): string => {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};

const addDays = (d: Date, days: number): Date => {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 0, 0, 0, 0);
};

const appointmentStart = (appointment: Appointment): Date => {
  return new Date(`${appointment.date}T${appointment.startTime}:00`);
};

const isOperationalAppointment = (appointment: Appointment): boolean => {
  return appointment.status === "scheduled" || appointment.status === "confirmed" || appointment.status === "in_progress";
};

const appointmentMatchesSucursal = (appointment: Appointment, sucursalId: string | null): boolean => {
  if (!sucursalId) return true;
  return !appointment.officeId || appointment.officeId === sucursalId;
};

const rowMatchesDashboardSucursal = (row: { sucursal_id?: string | null }, sucursalId: string | null): boolean => {
  if (!sucursalId) return true;
  return !row.sucursal_id || row.sucursal_id === sucursalId;
};

const weekDayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const weekDayIndex = (d: Date): number => {
  return (d.getDay() + 6) % 7;
};

const inRange = (d: Date, from: Date, to: Date): boolean => {
  const time = d.getTime();
  return time >= from.getTime() && time <= to.getTime();
};

const paymentStatusForRow = (row: ConsultationRow): string => {
  return row.payment_status ?? (row.paid ? "paid" : "pending");
};

const paidAmountForRow = (row: ConsultationRow): number => {
  const paymentStatus = paymentStatusForRow(row);
  const amount = row.amount_paid ?? (paymentStatus === "paid" || row.paid ? row.cost : 0);
  return Math.max(0, amount);
};

const pendingAmountForRow = (row: ConsultationRow): number => {
  return paymentStatusForRow(row) === "partial"
    ? Math.max(0, row.cost - paidAmountForRow(row))
    : row.cost;
};

/**
 * Hook del dashboard.
 *
 * Las métricas operativas futuras se limitan a pacientes activos. Los datos
 * históricos y financieros conservan pacientes inactivos o archivados para
 * no alterar consultas, ingresos ni saldos ya registrados.
 */
export function useDashboardKpis(): AsyncState<DashboardKpis> & { reload: () => void } {
  const [state, setState] = React.useState<AsyncState<DashboardKpis>>(initial);
  const syncSucursalId = useSyncStore((s) => s.sucursalId);
  const authSucursalId = useAuthStore((s) => s.sucursalActivaId);
  const role = useAuthStore((s) => s.user?.rol ?? null);
  const activeSucursalId = syncSucursalId ?? authSucursalId ?? null;
  const canViewFinancialData = Boolean(role && (BILLING_REPORT_ROLES as readonly string[]).includes(role));

  const load = React.useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthStart = startOfMonth(previousMonthDate);
    const previousMonthEnd = endOfMonth(previousMonthDate);
    const previousMonthComparisonEnd = new Date(
      previousMonthDate.getFullYear(),
      previousMonthDate.getMonth(),
      Math.min(now.getDate(), previousMonthEnd.getDate()),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds(),
    );
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const todayDateOnly = toDateOnly(now);
    const upcomingEndDateOnly = toDateOnly(addDays(now, 30));
    Promise.all([
      db.patients
        .filter((r) => r.deleted_at === null && rowMatchesDashboardSucursal(r, activeSucursalId))
        .toArray(),
      db.meal_plans
        .filter((r) =>
          r.deleted_at === null &&
          r.status === "active" &&
          rowMatchesDashboardSucursal(r, activeSucursalId),
        )
        .toArray(),
      canViewFinancialData ? db.consultations
        .filter((r) => {
           if (!rowMatchesDashboardSucursal(r, activeSucursalId)) return false;
           if (r.deleted_at) return false;
           if (r.status !== "completed") return false;
           const t = new Date(r.consultation_date).getTime();
           return t >= monthStart.getTime() && t <= now.getTime();
        })
        .toArray() : Promise.resolve([]),
      canViewFinancialData ? db.consultations
        .filter((r) => {
           if (!rowMatchesDashboardSucursal(r, activeSucursalId)) return false;
           if (r.deleted_at) return false;
           if (r.status !== "completed") return false;
           const t = new Date(r.consultation_date).getTime();
           return t >= weekStart.getTime() && t <= Math.min(weekEnd.getTime(), now.getTime());
        })
        .toArray() : Promise.resolve([]),
      db.consultations
        .filter((r) =>
          rowMatchesDashboardSucursal(r, activeSucursalId) &&
          !r.deleted_at &&
          (r.status === "scheduled" || r.status === "in-progress"),
        )
        .toArray(),
      agendaService.listByRange(todayDateOnly, upcomingEndDateOnly),
      db.consultations
        .filter((r) => {
           if (!rowMatchesDashboardSucursal(r, activeSucursalId)) return false;
           if (r.deleted_at) return false;
           if (!(r.cost > 0)) return false;
           if (r.status !== "completed" && r.status !== "in-progress") return false;
           const ps = paymentStatusForRow(r);
           return ps === "pending" || ps === "partial";
        })
        .toArray(),
      db.consultations
        .filter((r) => {
           if (!rowMatchesDashboardSucursal(r, activeSucursalId)) return false;
           if (r.deleted_at) return false;
           if (!(r.cost > 0)) return false;
           const ps = paymentStatusForRow(r);
           return ps === "paid" || ps === "partial";
        })
        .toArray(),
      db.sync_queue
        .filter((r) => r.status === "pending" || r.status === "error" || r.status === "conflict")
        .count(),
    ])
      .then(
        ([
          patientRows,
          activePlanRows,
          consultRowsThisMonth,
          consultRowsThisWeek,
          upcomingConsultationRows,
          appointmentRange,
          pendingRows,
          recentPaymentRows,
          pendingSync,
        ]) => {
           const patientsAll = patientRows.map(patientRowToDomain);
          const activePlansAll = activePlanRows.map(mealPlanRowToDomain);
          const consultsThisMonth = consultRowsThisMonth.map(consultationRowToDomain);
          const consultsThisWeek = consultRowsThisWeek.map(consultationRowToDomain);
          const upcomingConsultations = upcomingConsultationRows.map(consultationRowToDomain);
          const activePatientIds = new Set(
            patientsAll
              .filter((p) => p.status === "active")
              .map((p) => p.id.toString()),
          );
          const patientNamesById = Object.fromEntries(
            patientsAll.map((p) => [p.id.toString(), p.fullName]),
          );
          const activePlans = activePlansAll.filter((p) => activePatientIds.has(p.patientId.toString()));

          const expiring = activePlans
            .filter(
              (p) =>
                p.endDate &&
                withinDays(p.endDate, 7) &&
                activePatientIds.has(p.patientId.toString()),
            );

          const recent = [...patientsAll]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 5);
           const newPatientsThisMonth = patientsAll.filter(
             (p) => inRange(p.recordOpenedAt, monthStart, now),
           ).length;
           const newPatientsPreviousMonth = patientsAll.filter(
             (p) => inRange(p.recordOpenedAt, previousMonthStart, previousMonthComparisonEnd),
           ).length;

          const upcoming = upcomingConsultations.filter(
            (c) => activePatientIds.has(c.patientId.toString()),
          );

          const appointments = (appointmentRange as Appointment[])
            .filter((appointment) =>
              activePatientIds.has(appointment.patientId) &&
              appointmentMatchesSucursal(appointment, activeSucursalId) &&
              isOperationalAppointment(appointment),
            )
            .sort((a, b) => appointmentStart(a).getTime() - appointmentStart(b).getTime());
          const appointmentsToday = appointments.filter((appointment) => appointment.date === todayDateOnly);
          const unconfirmedAppointments = appointments.filter((appointment) => appointment.status === "scheduled");

           const thisMonth = consultsThisMonth;
           const todayConsultations = thisMonth.filter((c) => toDateOnly(c.consultationDate) === todayDateOnly);
           const consultationsToday = todayConsultations.length;
           const scheduledConsultationsToday = appointmentsToday.length;

          const weeklyActivity: DashboardWeeklyActivityPoint[] = weekDayLabels.map((day) => ({
            day,
            consultas: 0,
            nuevos: 0,
           }));
           consultsThisWeek
             .forEach((c) => {
               weeklyActivity[weekDayIndex(c.consultationDate)]!.consultas += 1;
             });
           patientsAll
             .filter((p) => inRange(p.recordOpenedAt, weekStart, now < weekEnd ? now : weekEnd))
            .forEach((p) => {
              weeklyActivity[weekDayIndex(p.recordOpenedAt)]!.nuevos += 1;
            });

          const weeksInMonth = Math.ceil(monthEnd.getDate() / 7);
          const monthlyActivity: DashboardWeeklyActivityPoint[] = Array.from({ length: weeksInMonth }, (_, index) => ({
            day: `Sem ${index + 1}`,
            consultas: 0,
            nuevos: 0,
          }));
          thisMonth.forEach((consultation) => {
            const weekIndex = Math.min(weeksInMonth - 1, Math.floor((consultation.consultationDate.getDate() - 1) / 7));
            monthlyActivity[weekIndex]!.consultas += 1;
           });
           patientsAll
             .filter((p) => inRange(p.recordOpenedAt, monthStart, now))
            .forEach((patient) => {
              const weekIndex = Math.min(weeksInMonth - 1, Math.floor((patient.recordOpenedAt.getDate() - 1) / 7));
              monthlyActivity[weekIndex]!.nuevos += 1;
            });

           const scopedPendingRows = pendingRows as ConsultationRow[];
          const scopedPendingRowsThisMonth = scopedPendingRows.filter((r) => {
            const t = new Date(r.consultation_date).getTime();
            return t >= monthStart.getTime() && t <= monthEnd.getTime();
           });
           const scopedIncomeRows = (recentPaymentRows as ConsultationRow[]).filter((r) => {
             const paymentDate = new Date(r.paid_at ?? r.consultation_date).getTime();
             return paymentDate >= monthStart.getTime() && paymentDate <= now.getTime();
           });
           const scopedPreviousIncomeRows = (recentPaymentRows as ConsultationRow[]).filter((r) => {
             const paymentDate = new Date(r.paid_at ?? r.consultation_date).getTime();
             return paymentDate >= previousMonthStart.getTime() && paymentDate <= previousMonthComparisonEnd.getTime();
           });
           const scopedRecentPaymentRows = recentPaymentRows as ConsultationRow[];

           const pendingPaymentsAmount = scopedPendingRows.reduce(
             (sum: number, r: ConsultationRow) => sum + pendingAmountForRow(r),
             0,
           );
           const pendingPaymentsAmountThisMonth = scopedPendingRowsThisMonth.reduce(
             (sum: number, r: ConsultationRow) => sum + pendingAmountForRow(r),
             0,
           );
           const incomeThisMonth = scopedIncomeRows.reduce(
             (sum: number, r: ConsultationRow) => sum + paidAmountForRow(r),
             0,
           );
          const incomeActivity = Array.from({ length: weeksInMonth }, () => 0);
          scopedIncomeRows.forEach((row) => {
             const paymentDate = new Date(row.paid_at ?? row.consultation_date);
             const weekIndex = Math.min(weeksInMonth - 1, Math.floor((paymentDate.getDate() - 1) / 7));
             incomeActivity[weekIndex] += paidAmountForRow(row);
           });
           const incomePreviousMonth = scopedPreviousIncomeRows.reduce(
             (sum: number, r: ConsultationRow) => sum + paidAmountForRow(r),
             0,
           );
           const recentPayments = scopedRecentPaymentRows
             .map((r) => {
               const paymentStatus = paymentStatusForRow(r);
               const amountPaid = paidAmountForRow(r);
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
              totalPatients: patientsAll.length,
              totalActivePatients: activePatientIds.size,
              newPatientsThisMonth,
              newPatientsPreviousMonth,
              activePlans: activePlans.length,
              consultationsToday,
              scheduledConsultationsToday,
              consultationsThisMonth: thisMonth.length,
              upcomingConsultations: upcoming,
              upcomingAppointments: appointments,
              appointmentsToday,
              unconfirmedAppointments,
              patientNamesById,
              expiringPlans: expiring,
              recentPatients: recent,
              pendingSync,
              pendingPayments: scopedPendingRows.length,
              pendingPaymentsAmount,
              pendingPaymentsThisMonth: scopedPendingRowsThisMonth.length,
              pendingPaymentsAmountThisMonth,
              incomeThisMonth,
              incomePreviousMonth,
              incomeActivity,
              paymentsThisMonth: scopedIncomeRows.length,
              recentPayments,
              weeklyActivity,
              monthlyActivity,
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
  }, [activeSucursalId, canViewFinancialData]);

  React.useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}

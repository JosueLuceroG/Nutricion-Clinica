import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import { useDashboardKpis, type DashboardKpis, type DashboardRecentPayment } from "@app/hooks/useDashboardKpis";
import { AppointmentTypeLabel } from "@modules/agenda/domain/AppointmentType";
import {
  DEFAULT_DASHBOARD_PREMIUM_KPI_IDS,
  usePreferencesStore,
  type DashboardPremiumKpiId,
} from "@store/preferencesStore";
import { AlertsAndPendingCard } from "./AlertsAndPendingCard";
import { DashboardKpiCustomizer } from "./DashboardKpiCustomizer";
import { DashboardShell } from "./DashboardShell";
import {
  type DashboardAlertItem,
  type DashboardKpiItem,
  type ActivitySummaryItem,
  type FinancialSummaryData,
  type WeeklyActivityPoint,
  dashboardAlerts,
  dashboardKpis,
  financialSummary,
  quickActions,
  weeklyActivitySummary,
} from "./dashboardMockData";
import { FinancialSummaryCard } from "./FinancialSummaryCard";
import { KpiCard } from "./KpiCard";
import { QuickActionsCard } from "./QuickActionsCard";
import { RecentPaymentsCard } from "./RecentPaymentsCard";
import { UpcomingConsultationsCard } from "./UpcomingConsultationsCard";
import { WeeklyActivityCard } from "./WeeklyActivityCard";

const avatarTones = ["warm", "cool", "rose", "slate"] as const;
const paymentAvatarTones = ["warm", "cool", "rose"] as const;
const weekDayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const emptyWeeklyActivity: WeeklyActivityPoint[] = weekDayLabels.map((day) => ({
  day,
  consultas: 0,
  nuevos: 0,
}));

function normalizeKpiOrder(order: DashboardPremiumKpiId[], items: DashboardKpiItem[]): DashboardPremiumKpiId[] {
  const validIds = new Set(items.map((item) => item.id));
  const normalized = order.filter((id, index) => validIds.has(id) && order.indexOf(id) === index);
  const fallbackOrder = DEFAULT_DASHBOARD_PREMIUM_KPI_IDS.filter((id) => validIds.has(id));

  for (const id of fallbackOrder) {
    if (!normalized.includes(id)) normalized.push(id);
  }
  for (const item of items) {
    if (!normalized.includes(item.id)) normalized.push(item.id);
  }

  return normalized;
}

function normalizeHiddenKpiIds(hiddenIds: DashboardPremiumKpiId[], items: DashboardKpiItem[]): DashboardPremiumKpiId[] {
  const validIds = new Set(items.map((item) => item.id));
  const normalized = hiddenIds.filter((id, index) => validIds.has(id) && hiddenIds.indexOf(id) === index);
  return normalized.length >= items.length ? [] : normalized;
}

function orderKpis(items: DashboardKpiItem[], order: DashboardPremiumKpiId[]): DashboardKpiItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return normalizeKpiOrder(order, items)
    .map((id) => byId.get(id))
    .filter((item): item is DashboardKpiItem => Boolean(item));
}

function money(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

function percentageTrend(current: number, previous: number): { label?: string; tone: "up" | "down" | "neutral" } {
  if (current === 0 && previous === 0) return { tone: "neutral" };
  if (previous === 0) return { label: "Nuevo", tone: "up" };
  const change = Math.round(((current - previous) / previous) * 100);
  if (change > 0) return { label: `↑ ${change}%`, tone: "up" };
  if (change < 0) return { label: `↓ ${Math.abs(change)}%`, tone: "down" };
  return { label: "0%", tone: "neutral" };
}

function currentMonthRangeLabel(now = new Date()): string {
  const month = new Intl.DateTimeFormat("es-MX", { month: "short" }).format(now).replace(".", "");
  return `Del 1 al ${now.getDate()} de ${month}`;
}

function initialsFromName(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return initials || "PX";
}

function buildLiveKpis(data: DashboardKpis | null): DashboardKpiItem[] {
  const [patients, consultations, income, pending] = dashboardKpis;

  if (!data) {
    return [
      {
        ...patients!,
        label: "Pacientes activos",
        value: "--",
        trend: undefined,
        hint: "Esperando datos reales",
      },
      {
        ...consultations!,
        label: "Consultas de hoy",
        value: "--",
        trend: undefined,
        hint: "Esperando datos reales",
      },
      {
        ...income!,
        label: "Ingresos del mes",
        value: money(0),
        trend: undefined,
        hint: "Sin datos cargados",
      },
      {
        ...pending!,
        label: "Pendiente de cobro",
        value: money(0),
        trend: undefined,
        hint: "Sin datos cargados",
      },
    ];
  }

  const patientTrend = percentageTrend(data.newPatientsThisMonth, data.newPatientsPreviousMonth);
  const incomeTrend = percentageTrend(data.incomeThisMonth, data.incomePreviousMonth);

  return [
    {
      ...patients!,
      label: "Pacientes activos",
      value: data.totalActivePatients.toString(),
      trend: patientTrend.label,
      trendTone: patientTrend.tone,
      hint: `${data.newPatientsThisMonth} nuevos este mes · ${data.totalPatients} registrados`,
    },
    {
      ...consultations!,
      label: "Consultas realizadas hoy",
      value: data.consultationsToday.toString(),
      trend: undefined,
      hint: `${data.scheduledConsultationsToday} citas en agenda`,
    },
    {
      ...income!,
      label: "Ingresos del mes",
      value: money(data.incomeThisMonth),
      trend: incomeTrend.label,
      trendTone: incomeTrend.tone,
      hint: currentMonthRangeLabel(),
    },
    {
      ...pending!,
      label: "Saldo pendiente total",
      value: money(data.pendingPaymentsAmount),
      trend: undefined,
      hint: `${data.pendingPayments} consultas con saldo`,
    },
  ];
}

function buildLiveAlerts(data: DashboardKpis | null): DashboardAlertItem[] {
  if (!data) return [];
  const [pendingPayment, unconfirmed, expiring] = dashboardAlerts;

  return [
    {
      ...pendingPayment!,
      title: `${data.pendingPayments} consultas pendientes de cobro`,
      detail: `Total: ${money(data.pendingPaymentsAmount)}`,
      count: data.pendingPayments > 0 ? "›" : "0",
      actionTo: "/billing",
    },
    {
      ...unconfirmed!,
      title: `${data.unconfirmedAppointments.length} citas sin confirmar`,
      detail: "Requieren confirmación",
      count: data.unconfirmedAppointments.length.toString(),
    },
    {
      ...expiring!,
      title: `${data.expiringPlans.length} planes por vencer`,
      detail: "Próximos 7 días",
      count: data.expiringPlans.length.toString(),
    },
  ];
}

function buildLiveFinancialSummary(data: DashboardKpis | null): FinancialSummaryData {
  const [paid, pending, average] = financialSummary.items;

  if (!data) {
    return {
      total: money(0),
      trend: "Sin datos cargados",
      objective: "Esperando datos reales",
      collectionRate: "0%",
      sparkline: [],
      items: [
        {
          ...paid!,
          value: money(0),
          detail: "Pagos liquidados este mes",
          percent: 0,
        },
        {
          ...pending!,
          value: money(0),
          detail: "Consultas pendientes",
          percent: 0,
        },
        {
          ...average!,
          value: money(0),
          detail: "Sin pagos este mes",
          percent: 0,
        },
      ],
    };
  }

  const totalOperational = data.incomeThisMonth + data.pendingPaymentsAmountThisMonth;
  const collectionPercent = totalOperational > 0
    ? Math.round((data.incomeThisMonth / totalOperational) * 100)
    : 0;
  const averageTicket = data.paymentsThisMonth > 0
    ? data.incomeThisMonth / data.paymentsThisMonth
    : 0;
  const incomeTrend = percentageTrend(data.incomeThisMonth, data.incomePreviousMonth);

  return {
    total: money(totalOperational),
    trend: incomeTrend.label ? `${incomeTrend.label} vs. mes anterior` : "Sin variación mensual",
    objective: totalOperational > 0 ? `${collectionPercent}% recuperado este mes` : "Sin cobros registrados este mes",
    collectionRate: `${collectionPercent}%`,
    sparkline: data.incomeActivity,
    items: [
      {
        ...paid!,
        value: money(data.incomeThisMonth),
        detail: `${data.paymentsThisMonth} pagos liquidados este mes`,
        percent: collectionPercent,
      },
      {
        ...pending!,
        value: money(data.pendingPaymentsAmountThisMonth),
        detail: `${data.pendingPaymentsThisMonth} consultas pendientes este mes`,
        percent: Math.max(0, 100 - collectionPercent),
      },
      {
        ...average!,
        value: money(averageTicket),
        detail: `${data.paymentsThisMonth} pagos registrados este mes`,
        percent: 0,
      },
    ],
  };
}

function appointmentTimeLabel(date: string, time: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(`${date}T${time}:00`));
}

function appointmentStatusLabel(status: string) {
  if (status === "in_progress") return "En curso" as const;
  if (status === "confirmed") return "Confirmada" as const;
  return "Pendiente" as const;
}

function buildLiveUpcomingConsultations(data: DashboardKpis | null) {
  if (!data) return [];
  if (data.upcomingAppointments.length > 0) {
    return data.upcomingAppointments
      .slice(0, 4)
      .map((appointment, index) => {
        const patientName = data.patientNamesById[appointment.patientId] ??
          `Paciente ${appointment.patientId.slice(0, 6)}`;

        return {
          time: appointmentTimeLabel(appointment.date, appointment.startTime),
          patient: patientName,
          type: appointment.reason || AppointmentTypeLabel[appointment.type],
          status: appointmentStatusLabel(appointment.status),
          avatar: initialsFromName(patientName),
          avatarTone: avatarTones[index % avatarTones.length] ?? "warm",
        };
      });
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return [...data.upcomingConsultations]
    .filter((consultation) =>
      consultation.status === "in-progress" || consultation.consultationDate.getTime() >= startOfToday,
    )
    .sort((a, b) => a.consultationDate.getTime() - b.consultationDate.getTime())
    .slice(0, 4)
    .map((consultation, index) => {
      const patientName = data.patientNamesById[consultation.patientId.toString()] ??
        `Paciente ${consultation.patientId.toString().slice(0, 6)}`;
      const time = new Intl.DateTimeFormat("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(consultation.consultationDate);

      return {
        time,
        patient: patientName,
        type: consultation.reason || `Consulta #${consultation.consultationNumber}`,
        status: consultation.status === "in-progress" ? "En curso" as const : "Confirmada" as const,
        avatar: initialsFromName(patientName),
        avatarTone: avatarTones[index % avatarTones.length] ?? "warm",
      };
    });
}

function paymentStatusLabel(status: DashboardRecentPayment["paymentStatus"]) {
  if (status === "paid") return "Pagado" as const;
  if (status === "partial") return "Parcial" as const;
  return "Pendiente" as const;
}

function paymentMethodLabel(method: DashboardRecentPayment["paymentMethod"]) {
  if (method === "cash") return "Efectivo";
  if (method === "card") return "Tarjeta";
  if (method === "transfer") return "Transferencia";
  if (method === "other") return "Otro";
  return "Sin metodo";
}

function paymentDateLabel(date: Date | null) {
  if (!date) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date).replace(".", "");
}

function buildLiveRecentPayments(data: DashboardKpis | null) {
  if (!data) return [];

  return data.recentPayments.map((payment, index) => {
    const date = payment.paidAt ?? payment.consultationDate;
    return {
      patient: payment.patientName,
      concept: payment.concept,
      amount: money(payment.amountPaid),
      date: paymentDateLabel(date),
      method: paymentMethodLabel(payment.paymentMethod),
      status: paymentStatusLabel(payment.paymentStatus),
      avatar: initialsFromName(payment.patientName),
      avatarTone: paymentAvatarTones[index % paymentAvatarTones.length] ?? "warm",
    };
  });
}

function buildLiveWeeklyActivity(data: DashboardKpis | null): WeeklyActivityPoint[] {
  if (!data) return emptyWeeklyActivity;
  return data.weeklyActivity;
}

function buildLiveMonthlyActivity(data: DashboardKpis | null): WeeklyActivityPoint[] {
  if (!data) return [];
  return data.monthlyActivity;
}

function busiestConsultationPeriod(points: WeeklyActivityPoint[]): string {
  const busiest = points.reduce<WeeklyActivityPoint | null>(
    (current, point) => !current || point.consultas > current.consultas ? point : current,
    null,
  );
  return busiest && busiest.consultas > 0 ? busiest.day : "--";
}

function buildLiveWeeklyActivitySummary(data: DashboardKpis | null): ActivitySummaryItem[] {
  const [consultations, newPatients, period] = weeklyActivitySummary;
  if (!data) {
    return [
      {
        ...consultations!,
        value: "0",
      },
      {
        ...newPatients!,
        value: "0",
      },
      {
        ...period!,
        value: "--",
        label: "Día con más consultas",
      },
    ];
  }

  const totalConsultations = data.weeklyActivity.reduce((sum, item) => sum + item.consultas, 0);
  const totalNewPatients = data.weeklyActivity.reduce((sum, item) => sum + item.nuevos, 0);

  return [
    {
      ...consultations!,
      value: totalConsultations.toString(),
    },
    {
      ...newPatients!,
      value: totalNewPatients.toString(),
    },
    {
      ...period!,
      value: busiestConsultationPeriod(data.weeklyActivity),
      label: "Día con más consultas",
    },
  ];
}

function buildLiveMonthlyActivitySummary(data: DashboardKpis | null): ActivitySummaryItem[] {
  const [consultations, newPatients, period] = weeklyActivitySummary;
  const monthlyData = data?.monthlyActivity ?? [];
  return [
    {
      ...consultations!,
      value: monthlyData.reduce((sum, item) => sum + item.consultas, 0).toString(),
    },
    {
      ...newPatients!,
      value: monthlyData.reduce((sum, item) => sum + item.nuevos, 0).toString(),
    },
    {
      ...period!,
      value: busiestConsultationPeriod(monthlyData),
      label: "Semana con más consultas",
    },
  ];
}

export function DashboardPage() {
  const { data, loading, error } = useDashboardKpis();
  const [isKpiCustomizerOpen, setKpiCustomizerOpen] = React.useState(false);
  const kpiOrder = usePreferencesStore((state) => state.dashboardPremiumKpiOrder);
  const hiddenKpiIds = usePreferencesStore((state) => state.dashboardPremiumKpiHiddenIds);
  const setKpiOrder = usePreferencesStore((state) => state.setDashboardPremiumKpiOrder);
  const setHiddenKpiIds = usePreferencesStore((state) => state.setDashboardPremiumKpiHiddenIds);
  const resetDashboardPremiumKpis = usePreferencesStore((state) => state.resetDashboardPremiumKpis);
  const liveKpis = buildLiveKpis(data);
  const orderedKpis = orderKpis(liveKpis, kpiOrder);
  const normalizedHiddenKpiIds = normalizeHiddenKpiIds(hiddenKpiIds, liveKpis);
  const hiddenKpiSet = new Set(normalizedHiddenKpiIds);
  const visibleKpis = orderedKpis.filter((item) => !hiddenKpiSet.has(item.id));
  const liveAlerts = buildLiveAlerts(data);
  const liveFinancialSummary = buildLiveFinancialSummary(data);
  const liveUpcomingConsultations = buildLiveUpcomingConsultations(data);
  const liveRecentPayments = buildLiveRecentPayments(data);
  const liveWeeklyActivity = buildLiveWeeklyActivity(data);
  const liveMonthlyActivity = buildLiveMonthlyActivity(data);
  const liveWeeklyActivitySummary = buildLiveWeeklyActivitySummary(data);
  const liveMonthlyActivitySummary = buildLiveMonthlyActivitySummary(data);

  const moveKpi = (id: DashboardPremiumKpiId, direction: -1 | 1) => {
    const order = normalizeKpiOrder(kpiOrder, liveKpis);
    const index = order.indexOf(id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
    const next = [...order];
    [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
    setKpiOrder(next);
  };

  const toggleKpi = (id: DashboardPremiumKpiId) => {
    const hiddenIds = normalizeHiddenKpiIds(hiddenKpiIds, liveKpis);
    if (hiddenIds.includes(id)) {
      setHiddenKpiIds(hiddenIds.filter((hiddenId) => hiddenId !== id));
      return;
    }
    if (liveKpis.length - hiddenIds.length <= 1) return;
    setHiddenKpiIds([...hiddenIds, id]);
  };

  return (
    <DashboardShell onCustomizeKpis={() => setKpiCustomizerOpen(true)}>
      <h1 className="sr-only">Dashboard</h1>

      {(loading || error) && (
        <div className={`nc-dashboard-data-status${error ? " nc-dashboard-data-status--error" : ""}`} role={error ? "alert" : "status"}>
          {error
            ? "No se pudieron cargar los datos reales; se muestran valores vacíos."
            : "Actualizando métricas reales del consultorio..."}
        </div>
      )}

      <div className="nc-dashboard-kpi-action-row">
        <button type="button" className="nc-dashboard-kpi-action" onClick={() => setKpiCustomizerOpen(true)}>
          <SlidersHorizontal size={14} strokeWidth={2} aria-hidden="true" />
          <span>Reordenar / ocultar métricas</span>
        </button>
      </div>

      <section className="nc-dashboard-kpi-grid" aria-label="Métricas principales">
        {visibleKpis.map((item) => (
          <KpiCard key={item.id} item={item} />
        ))}
      </section>

      <section className="nc-dashboard-content-grid" aria-label="Resumen operativo">
        <UpcomingConsultationsCard items={liveUpcomingConsultations} />
        <WeeklyActivityCard
          weeklyData={liveWeeklyActivity}
          monthlyData={liveMonthlyActivity}
          weeklySummary={liveWeeklyActivitySummary}
          monthlySummary={liveMonthlyActivitySummary}
        />
        <AlertsAndPendingCard alerts={liveAlerts} />
      </section>

      <section className="nc-dashboard-content-grid nc-dashboard-content-grid--compact" aria-label="Resumen financiero y accesos rápidos">
        <FinancialSummaryCard summary={liveFinancialSummary} />
        <RecentPaymentsCard payments={liveRecentPayments} />
        <QuickActionsCard actions={quickActions} />
      </section>

      <DashboardKpiCustomizer
        open={isKpiCustomizerOpen}
        items={orderedKpis}
        hiddenIds={normalizedHiddenKpiIds}
        onClose={() => setKpiCustomizerOpen(false)}
        onMove={moveKpi}
        onToggle={toggleKpi}
        onReset={resetDashboardPremiumKpis}
      />
    </DashboardShell>
  );
}

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import { useDashboardKpis, type DashboardKpis, type DashboardRecentPayment } from "@app/hooks/useDashboardKpis";
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
  recentPayments,
  upcomingConsultations,
  weeklyActivityData,
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
  if (!data) return dashboardKpis;
  const [patients, consultations, income, pending] = dashboardKpis;

  return [
    {
      ...patients!,
      value: data.totalActivePatients.toString(),
      trend: data.totalActivePatients > 0 ? "Activo" : undefined,
      hint: `${data.totalPatients} pacientes registrados`,
    },
    {
      ...consultations!,
      value: data.consultationsToday.toString(),
      hint: `${data.consultationsThisMonth} consultas este mes`,
    },
    {
      ...income!,
      value: money(data.incomeThisMonth),
      trend: undefined,
      hint: "Ingresos liquidados este mes",
    },
    {
      ...pending!,
      value: money(data.pendingPaymentsAmount),
      hint: `${data.pendingPayments} consultas pendientes`,
    },
  ];
}

function buildLiveAlerts(data: DashboardKpis | null): DashboardAlertItem[] {
  if (!data) return dashboardAlerts;
  const [pendingPayment, upcoming, expiring] = dashboardAlerts;

  return [
    {
      ...pendingPayment!,
      title: `${data.pendingPayments} consultas pendientes de cobro`,
      detail: `Total: ${money(data.pendingPaymentsAmount)}`,
      count: data.pendingPayments > 0 ? "›" : "0",
    },
    {
      ...upcoming!,
      title: `${data.upcomingConsultations.length} consultas próximas`,
      detail: "Agenda operativa",
      count: data.upcomingConsultations.length.toString(),
    },
    {
      ...expiring!,
      title: `${data.expiringPlans.length} planes por vencer`,
      detail: "Próximos 30 días",
      count: data.expiringPlans.length.toString(),
    },
  ];
}

function buildLiveFinancialSummary(data: DashboardKpis | null): FinancialSummaryData {
  if (!data) return financialSummary;
  const totalOperational = data.incomeThisMonth + data.pendingPaymentsAmount;
  const collectionPercent = totalOperational > 0
    ? Math.round((data.incomeThisMonth / totalOperational) * 100)
    : 100;
  const averageTicket = data.consultationsThisMonth > 0
    ? data.incomeThisMonth / data.consultationsThisMonth
    : 0;
  const [paid, pending, average] = financialSummary.items;

  return {
    total: money(totalOperational),
    trend: "Datos reales del mes",
    objective: `${collectionPercent}% recuperado del total operativo`,
    collectionRate: `${collectionPercent}%`,
    items: [
      {
        ...paid!,
        value: money(data.incomeThisMonth),
        detail: "Pagos liquidados",
        percent: collectionPercent,
      },
      {
        ...pending!,
        value: money(data.pendingPaymentsAmount),
        detail: `${data.pendingPayments} consultas pendientes`,
        percent: Math.max(0, 100 - collectionPercent),
      },
      {
        ...average!,
        value: money(averageTicket),
        detail: `${data.consultationsThisMonth} consultas del mes`,
        percent: data.consultationsThisMonth > 0 ? 82 : 0,
      },
    ],
  };
}

function buildLiveUpcomingConsultations(data: DashboardKpis | null) {
  if (!data) return upcomingConsultations;
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
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOfToday - startOfDate) / 86_400_000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" }).format(date);
}

function buildLiveRecentPayments(data: DashboardKpis | null) {
  if (!data) return recentPayments;

  return data.recentPayments.map((payment, index) => {
    const date = payment.paidAt ?? payment.updatedAt ?? payment.consultationDate;
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
  if (!data) return weeklyActivityData;
  return data.weeklyActivity;
}

function buildLiveWeeklyActivitySummary(data: DashboardKpis | null): ActivitySummaryItem[] {
  if (!data) return weeklyActivitySummary;
  const [consultations, newPatients, period] = weeklyActivitySummary;
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
      value: "7",
      label: "Días monitoreados",
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
  const liveWeeklyActivitySummary = buildLiveWeeklyActivitySummary(data);

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
            ? "No se pudieron cargar los datos reales; se muestran valores de referencia."
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
        <WeeklyActivityCard data={liveWeeklyActivity} summary={liveWeeklyActivitySummary} />
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

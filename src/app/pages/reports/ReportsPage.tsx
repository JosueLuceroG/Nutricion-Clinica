import * as React from "react";
import { ReportsPage as ReportsView } from "@modules/reports/ui/ReportsPage";
import { useIndicators } from "@modules/reports/ui/useReportHooks";
import { reportService } from "@services/reportService";
import { fetchDashboardMetrics, type DashboardMetrics } from "@services/api/dashboardApi";
import { db } from "@services/db";
import type { PatientRow } from "@modules/patient/infrastructure/patientMapper";
import type { ConsultationRow } from "@modules/consultation/infrastructure/consultationMapper";
import type { AdherenceIndexRow } from "@modules/adherence/infrastructure/adherenceMapper";

const EMPTY_KPIS = {
  consultationsPerWeek: 0,
  averageAdherence: 0,
  activePatients: 0,
  consultationsThisMonth: 0,
  pendingPayments: 0,
};

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

type LocalPatientMetricRow = Pick<PatientRow, "status" | "deleted_at" | "clinical_tags" | "created_at">;
type LocalConsultationMetricRow = Pick<ConsultationRow, "consultation_date" | "paid" | "deleted_at">;
type LocalAdherenceMetricRow = Pick<AdherenceIndexRow, "score_global">;

export interface LocalReportSource {
  patients: LocalPatientMetricRow[];
  totalConsultations: number;
  monthConsultations: LocalConsultationMetricRow[];
  pendingPayments: number;
  adherenceIndexes: LocalAdherenceMetricRow[];
  trendConsultations: LocalConsultationMetricRow[];
  now?: Date;
}

export interface ReportDashboardData {
  metrics: DashboardMetrics;
  consultationTrends?: Array<{ month: string; consultations: number; payments: number }>;
}

export function buildReportKpis(metrics: DashboardMetrics | null) {
  if (!metrics) return EMPTY_KPIS;
  return {
    consultationsPerWeek: metrics.consultas.total,
    averageAdherence: metrics.adherencia.promedioGlobal != null ? Math.round(metrics.adherencia.promedioGlobal * 100) / 100 : 0,
    activePatients: metrics.pacientes.activos,
    consultationsThisMonth: metrics.consultas.esteMes,
    pendingPayments: metrics.consultas.pendientesPago,
  };
}

export function buildPathologyDistribution(metrics: DashboardMetrics | null): Array<{ name: string; value: number }> | undefined {
  if (!metrics?.patologias.length) return undefined;
  return metrics.patologias.map((p) => ({ name: p.tag, value: p.count }));
}

export function buildLocalReportDashboardData(source: LocalReportSource): ReportDashboardData {
  const now = source.now ?? new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const activePatients = source.patients.filter((patient) => patient.status === "active" && patient.deleted_at === null);
  const newThisMonth = activePatients.filter((patient) => new Date(patient.created_at).getTime() >= monthStart).length;
  const adherenceAverage = source.adherenceIndexes.length > 0
    ? source.adherenceIndexes.reduce((sum, row) => sum + row.score_global, 0) / source.adherenceIndexes.length
    : null;

  return {
    metrics: {
      pacientes: {
        total: activePatients.length,
        activos: activePatients.length,
        inactivos: 0,
        archivados: 0,
        nuevosEsteMes: newThisMonth,
      },
      sexoDistribucion: [],
      consultas: {
        total: source.totalConsultations,
        esteMes: source.monthConsultations.filter((row) => row.deleted_at === null).length,
        pendientesPago: source.pendingPayments,
      },
      planesAlimenticios: {
        activos: 0,
        porVencer: 0,
      },
      adherencia: {
        promedioGlobal: adherenceAverage,
        totalRegistros: source.adherenceIndexes.length,
      },
      patologias: buildLocalPathologyCounts(activePatients),
    },
    consultationTrends: buildLocalConsultationTrends(source.trendConsultations),
  };
}

async function fetchLocalReportDashboardData(now = new Date()): Promise<ReportDashboardData> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
  const adherenceStart = toDateOnly(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()));

  const [patients, totalConsultations, monthConsultations, pendingPayments, adherenceIndexes, trendConsultations] = await Promise.all([
    db.patients
      .where("status")
      .equals("active")
      .filter((row) => row.deleted_at === null)
      .limit(2000)
      .toArray(),
    db.consultations
      .filter((row) => row.deleted_at === null)
      .count(),
    db.consultations
      .where("consultation_date")
      .between(monthStart, nextMonthStart, true, false)
      .filter((row) => row.deleted_at === null)
      .toArray(),
    db.consultations
      .filter((row) => row.deleted_at === null && !row.paid && row.cost > 0)
      .count(),
    db.adherence_indexes
      .where("period_end")
      .aboveOrEqual(adherenceStart)
      .toArray(),
    db.consultations
      .where("consultation_date")
      .between(trendStart, nextMonthStart, true, false)
      .filter((row) => row.deleted_at === null)
      .toArray(),
  ]);

  return buildLocalReportDashboardData({
    patients,
    totalConsultations,
    monthConsultations,
    pendingPayments,
    adherenceIndexes,
    trendConsultations,
    now,
  });
}

function buildLocalPathologyCounts(patients: LocalPatientMetricRow[]): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const patient of patients) {
    for (const tag of parseClinicalTags(patient.clinical_tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));
}

function buildLocalConsultationTrends(rows: LocalConsultationMetricRow[]): Array<{ month: string; consultations: number; payments: number }> | undefined {
  const byMonth = new Map<string, { sortKey: string; consultations: number; payments: number }>();
  for (const row of rows) {
    if (row.deleted_at !== null) continue;
    const date = new Date(row.consultation_date);
    if (Number.isNaN(date.getTime())) continue;
    const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const month = `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
    const entry = byMonth.get(month) ?? { sortKey, consultations: 0, payments: 0 };
    entry.consultations++;
    if (row.paid) entry.payments++;
    byMonth.set(month, entry);
  }
  const trends = Array.from(byMonth.entries())
    .sort((a, b) => a[1].sortKey.localeCompare(b[1].sortKey))
    .map(([month, data]) => ({ month, consultations: data.consultations, payments: data.payments }));
  return trends.length > 0 ? trends : undefined;
}

function parseClinicalTags(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0).map((tag) => tag.trim());
  } catch {
    return [];
  }
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function ReportsPage() {
  const { indicators, loading: indicatorsLoading, refresh } = useIndicators(reportService);
  const [dashboardMetrics, setDashboardMetrics] = React.useState<DashboardMetrics | null>(null);
  const [localConsultationTrends, setLocalConsultationTrends] = React.useState<Array<{ month: string; consultations: number; payments: number }> | undefined>(undefined);
  const [metricsLoading, setMetricsLoading] = React.useState(true);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setMetricsLoading(true);

    const loadMetrics = async () => {
      try {
        const metrics = await fetchDashboardMetrics(controller.signal);
        if (cancelled) return;
        setDashboardMetrics(metrics);
        setLocalConsultationTrends(undefined);
      } catch {
        if (cancelled || controller.signal.aborted) return;
        try {
          const localData = await fetchLocalReportDashboardData();
          if (cancelled) return;
          setDashboardMetrics(localData.metrics);
          setLocalConsultationTrends(localData.consultationTrends);
        } catch {
          if (cancelled) return;
          setDashboardMetrics(null);
          setLocalConsultationTrends(undefined);
        }
      } finally {
        if (!cancelled) setMetricsLoading(false);
      }
    };

    void loadMetrics();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadToken]);

  const kpis = React.useMemo(() => buildReportKpis(dashboardMetrics), [dashboardMetrics]);
  const pathologyDistribution = React.useMemo(() => buildPathologyDistribution(dashboardMetrics), [dashboardMetrics]);

  const indicatorValues = React.useMemo(() => new Map(), []);

  const loading = indicatorsLoading || metricsLoading;

  const handleRefresh = React.useCallback(() => {
    refresh();
    setReloadToken((value) => value + 1);
  }, [refresh]);

  return (
    <ReportsView
      service={reportService}
      kpis={kpis}
      indicators={indicators}
      indicatorValues={indicatorValues}
      pathologyDistribution={pathologyDistribution}
      consultationTrends={localConsultationTrends}
      loading={loading}
      onRefresh={handleRefresh}
    />
  );
}

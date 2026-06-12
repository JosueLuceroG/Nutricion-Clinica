import * as React from "react";
import { ReportsPage as ReportsView } from "@modules/reports/ui/ReportsPage";
import { useIndicators } from "@modules/reports/ui/useReportHooks";
import { reportService } from "@services/reportService";
import { fetchDashboardMetrics, type DashboardMetrics } from "@services/api/dashboardApi";

const EMPTY_KPIS = {
  consultationsPerWeek: 0,
  averageAdherence: 0,
  activePatients: 0,
  consultationsThisMonth: 0,
  pendingPayments: 0,
};

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

export function ReportsPage() {
  const { indicators, loading: indicatorsLoading, refresh } = useIndicators(reportService);
  const [dashboardMetrics, setDashboardMetrics] = React.useState<DashboardMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = React.useState(true);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    setMetricsLoading(true);
    fetchDashboardMetrics(controller.signal)
      .then(setDashboardMetrics)
      .catch(() => setDashboardMetrics(null))
      .finally(() => setMetricsLoading(false));
    return () => controller.abort();
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
      consultationTrends={undefined}
      loading={loading}
      onRefresh={handleRefresh}
    />
  );
}

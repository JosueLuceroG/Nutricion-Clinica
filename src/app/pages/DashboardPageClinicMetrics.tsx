import * as React from "react";
import { useTranslation } from "react-i18next";
import { Activity, DollarSign, Heart, LineChart, Pill, Star, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { fetchDashboardMetrics, type DashboardMetrics } from "@services/api/dashboardApi";

export function ClinicMetricsCards() {
  const { t } = useTranslation();
  const [metrics, setMetrics] = React.useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchDashboardMetrics(controller.signal)
      .then(setMetrics)
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const adherencePct = metrics.adherencia.promedioGlobal != null ? Math.round(metrics.adherencia.promedioGlobal) : null;

  return (
    <div className="space-y-6 mt-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={t("dashboard.metrics.new_patients")}
          value={metrics.pacientes.nuevosEsteMes}
          icon={Users}
          hint={t("dashboard.metrics.this_month")}
        />
        <MetricCard
          label={t("dashboard.metrics.consultations_pending_payment")}
          value={metrics.consultas.pendientesPago}
          icon={DollarSign}
          hint={t("dashboard.metrics.unpaid")}
        />
        <MetricCard
          label={t("dashboard.metrics.avg_adherence")}
          value={adherencePct != null ? `${adherencePct}%` : "--"}
          icon={Activity}
          hint={t("dashboard.metrics.adherence_records", { count: metrics.adherencia.totalRegistros })}
        />
        <MetricCard
          label={t("dashboard.metrics.expiring_plans_count")}
          value={metrics.planesAlimenticios.porVencer}
          icon={Star}
          hint={t("dashboard.metrics.plans_expiring_30d")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Heart className="h-4 w-4 text-primary" />
              {t("dashboard.metrics.patient_demographics")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>{t("common.active")}</span>
                <span className="font-medium">{metrics.pacientes.activos}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${metrics.pacientes.total > 0 ? (metrics.pacientes.activos / metrics.pacientes.total) * 100 : 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>{t("common.inactive")}</span>
                <span className="font-medium">{metrics.pacientes.inactivos}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>{t("common.archived")}</span>
                <span className="font-medium">{metrics.pacientes.archivados}</span>
              </div>
              <div className="pt-2 text-xs text-muted-foreground">
                {t("dashboard.metrics.total_patients", { count: metrics.pacientes.total })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <LineChart className="h-4 w-4 text-primary" />
              {t("dashboard.metrics.consultation_stats")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>{t("dashboard.metrics.total_consultations")}</span>
                <span className="font-medium">{metrics.consultas.total}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>{t("dashboard.metrics.consultations_this_month")}</span>
                <span className="font-medium">{metrics.consultas.esteMes}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>{t("dashboard.metrics.pending_payments")}</span>
                <span className="font-medium">{metrics.consultas.pendientesPago}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>{t("dashboard.metrics.active_plans")}</span>
                <span className="font-medium">{metrics.planesAlimenticios.activos}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>{t("dashboard.metrics.plans_expiring")}</span>
                <span className="font-medium">{metrics.planesAlimenticios.porVencer}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {metrics.sexoDistribucion.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-primary" />
                {t("dashboard.metrics.sex_distribution")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics.sexoDistribucion.map((s) => (
                  <div key={s.sexo} className="flex items-center justify-between text-sm">
                    <span>{t(`patient.sex_${s.sexo}`)}</span>
                    <span className="font-medium">{s.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {metrics.patologias.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Pill className="h-4 w-4 text-primary" />
                {t("dashboard.metrics.pathology_distribution")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {metrics.patologias.map((p) => (
                  <div key={p.tag} className="flex items-center justify-between text-sm">
                    <span>{p.tag}</span>
                    <Badge variant="secondary">{p.count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number | null;
  icon: React.ElementType;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value != null ? value : "--"}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

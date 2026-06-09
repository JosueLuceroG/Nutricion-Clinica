import * as React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Activity, TrendingUp, Users, Calendar, DollarSign, FileText, Loader2 } from "lucide-react";
import type { Indicator } from "../domain/Indicator";
import type { IndicatorValue } from "../domain/IndicatorValue";
import type { ReportService } from "./useReportHooks";
import { ReportGeneratorDialog } from "./ReportGeneratorDialog";

interface ReportsPageProps {
  service: ReportService;
  kpis: {
    consultationsPerWeek: number;
    averageAdherence: number;
    activePatients: number;
    consultationsThisMonth: number;
    pendingPayments: number;
  };
  indicators: Indicator[];
  indicatorValues: Map<string, IndicatorValue[]>;
  loading: boolean;
  onRefresh: () => void;
}

const categoryColor: Record<string, string> = {
  consultas: "bg-blue-100 text-blue-700",
  adherencia: "bg-green-100 text-green-700",
  patologias: "bg-purple-100 text-purple-700",
  financiero: "bg-amber-100 text-amber-700",
};

function TrendIndicator({ value }: { value: number | undefined }) {
  if (value === undefined) return null;
  return (
    <span className={`ml-1 text-xs ${value >= 0 ? "text-green-600" : "text-red-600"}`}>
      {value >= 0 ? "+" : ""}{value.toFixed(1)}
    </span>
  );
}

export function ReportsPage({ service, kpis, indicators, indicatorValues, loading, onRefresh }: ReportsPageProps) {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("reports.title")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onRefresh} disabled={loading}>
            {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {t("common.search")}
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <FileText className="mr-1 h-4 w-4" />
            {t("reports.generate")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("reports.kpi_total_consultations")}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.consultationsPerWeek}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("reports.kpi_avg_adherence")}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.averageAdherence}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("reports.kpi_total_patients")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.activePatients}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("billing.paid_consultations")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.consultationsThisMonth}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("billing.pending_payments")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.pendingPayments}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("reports.indicators")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : indicators.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">{t("reports.no_reports")}</p>
          ) : (
            <div className="space-y-2">
              {indicators.map((ind) => {
                const vals = indicatorValues.get(ind.id) ?? [];
                const latest = vals.length > 0 ? vals[vals.length - 1] : null;
                const prev = vals.length > 1 ? vals[vals.length - 2] : null;
                const trend = latest && prev ? latest.value - prev.value : undefined;
                return (
                  <div key={ind.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={categoryColor[ind.category] ?? ""}>
                        {ind.category}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{ind.name}</p>
                        <p className="text-xs text-muted-foreground">{ind.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      {latest ? (
                        <div>
                          <p className="text-lg font-bold">{latest.value}</p>
                          <p className="text-[10px] text-muted-foreground">{ind.unit}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{t("common.no_data")}</p>
                      )}
                      <TrendIndicator value={trend} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ReportGeneratorDialog
        service={service}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

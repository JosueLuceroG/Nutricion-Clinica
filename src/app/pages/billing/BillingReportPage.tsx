import { useTranslation } from "react-i18next";
import i18n from "../../../i18n/config";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { Skeleton } from "@components/ui/skeleton";
import { useFinancialReport } from "@modules/consultation/ui/useFinancialReport";
import { formatCurrency } from "@utils/formatCurrency";

const MXN = (n: number) => formatCurrency(n, "MXN", i18n.language);

/**
 * Reporte financiero (Sprint 14D).
 * - KPIs: ingresos, pendientes, # consultas pagadas, # pacientes activos.
 * - Gráfico Recharts: barras apiladas ingresos vs pendientes por mes.
 * - Top pacientes por total pagado.
 *
 * Restringido a roles `admin` y `facturacion` (RequireRole en el router).
 */
export const BillingReportPage = () => {
  const { t } = useTranslation();
  const report = useFinancialReport(180, 6, 5);

  if (report === null) {
    return (
      <>
        <PageHeader title={t("billing.report_title")} />
        <PageContent>
          <div className="grid gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="mt-4 h-80 w-full" />
        </PageContent>
      </>
    );
  }

  const onExport = () => {
    const lines = [
      [t("billing.csv_month"), t("billing.income_total"), t("billing.pending"), t("billing.csv_paid_count"), t("billing.csv_pending_count")].join(","),
      ...report.monthly.map((m) =>
        [m.monthKey, m.income.toFixed(2), m.pending.toFixed(2), m.paidCount, m.pendingCount].join(","),
      ),
      [],
      [t("billing.top_patients")].join(","),
      [t("common.patient"), t("consultation.title"), t("billing.column_total_paid")].join(","),
      ...report.topPatients.map((p) =>
        [`"${p.patientName.replace(/"/g, '""')}"`, p.consultations, p.totalPaid.toFixed(2)].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t("billing.report_filename")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title={t("billing.report_title")}
        description={`${t("billing.filter_by_date")} · ${new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(report.rangeStart)} → ${new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(report.rangeEnd)}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/billing">
                <TrendingUp className="mr-2 h-4 w-4" />
                {t("billing.pending")}
              </Link>
            </Button>
            <Button onClick={onExport} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              {t("billing.export_csv")}
            </Button>
          </div>
        }
      />
      <PageContent>
        <div className="grid gap-4 sm:grid-cols-4">
          <Kpi title={t("billing.income_total")} value={MXN(report.totalIncome)} tone="success" />
          <Kpi title={t("billing.pending_collection")} value={MXN(report.totalPending)} tone="warning" />
          <Kpi title={t("billing.paid_consultations")} value={String(report.paidCount)} tone="info" />
          <Kpi title={t("billing.active_patients")} value={String(report.activePatients)} tone="info" />
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{t("billing.monthly_income")}</CardTitle>
            <CardDescription>{`${t("billing.income_total")} vs ${t("billing.pending")}`}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={report.monthly}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                    }
                  />
                  <Tooltip
                    formatter={(v: number) => MXN(v)}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Legend />
                  <Bar dataKey="income" name={t("billing.income_total")} fill="#10b981" stackId="a" />
                  <Bar dataKey="pending" name={t("billing.pending")} fill="#f59e0b" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{t("billing.top_patients")}</CardTitle>
            <CardDescription>{`${t("billing.column_total_paid")} - ${t("billing.top_patients")}`}</CardDescription>
          </CardHeader>
          <CardContent>
            {report.topPatients.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("billing.no_pending")}
              </p>
            ) : (
              <ol className="space-y-2">
                {report.topPatients.map((p, i) => (
                  <li
                    key={p.patientId}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="default">#{i + 1}</Badge>
                      <div>
                        <p className="font-medium">{p.patientName}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.consultations} {t("consultation.title_single", { count: p.consultations }).toLowerCase()}
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold">{MXN(p.totalPaid)}</p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
};

const Kpi = ({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "success" | "warning" | "info";
}) => (
  <Card>
    <CardHeader className="pb-2">
      <CardDescription className="text-xs uppercase tracking-wider">
        {title}
      </CardDescription>
      <CardTitle className="text-2xl">
        <Badge variant={tone}>{value}</Badge>
      </CardTitle>
    </CardHeader>
  </Card>
);

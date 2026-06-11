import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@i18n/config";
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
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { Skeleton } from "@components/ui/skeleton";
import { useFinancialReport } from "@modules/consultation/ui/useFinancialReport";
import { formatCurrency } from "@utils/formatCurrency";

const MXN = (n: number) => formatCurrency(n, "MXN", i18n.language);

const toIsoInputDate = (d: Date): string => d.toISOString().slice(0, 10);

export const BillingReportPage = () => {
  const today = useMemo(() => new Date(), []);
  const initialFrom = useMemo(() => {
    const d = new Date(today);
    d.setMonth(d.getMonth() - 6);
    return d;
  }, [today]);

  const [from, setFrom] = useState<Date>(initialFrom);
  const [to, setTo] = useState<Date>(today);
  const { t } = useTranslation();

  const report = useFinancialReport(from, to, 5);

  const onExport = () => {
    if (!report) return;
    const lines = [
      ["Mes", "Ingresos", "Pendiente", "Gastos", "Pagadas", "Pendientes"].join(","),
      ...report.monthly.map((m) =>
        [m.monthKey, m.income.toFixed(2), m.pending.toFixed(2), m.expenses.toFixed(2), m.paidCount, m.pendingCount].join(","),
      ),
      [],
      ["Top pacientes"].join(","),
      ["Paciente", "Consultas", "Total pagado"].join(","),
      ...report.topPatients.map((p) =>
        [`"${p.patientName.replace(/"/g, '""')}"`, p.consultations, p.totalPaid.toFixed(2)].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-financiero-${toIsoInputDate(today)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title={t("billing.report_title")}
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
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{t("common.filter")}</CardTitle>
            <CardDescription>{t("billing.filter_by_date")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="rfrom">{t("billing.from")}</Label>
                <Input
                  id="rfrom"
                  type="date"
                  value={toIsoInputDate(from)}
                  onChange={(e) => setFrom(e.target.value ? new Date(e.target.value) : initialFrom)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rto">{t("billing.to")}</Label>
                <Input
                  id="rto"
                  type="date"
                  value={toIsoInputDate(to)}
                  onChange={(e) => setTo(e.target.value ? new Date(e.target.value) : today)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {report === null ? (
          <div className="grid gap-4 sm:grid-cols-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
            <Skeleton className="mt-4 h-80 w-full col-span-4" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-5">
              <Kpi title={t("billing.income_total")} value={MXN(report.totalIncome)} tone="success" />
              <Kpi title={t("billing.pending_collection")} value={MXN(report.totalPending)} tone="warning" />
              <Kpi title={t("expenses.total")} value={MXN(report.totalExpenses)} tone="destructive" />
              <Kpi title={t("billing.net_income")} value={MXN(report.netIncome)} tone={report.netIncome >= 0 ? "success" : "destructive"} />
              <Kpi title={t("billing.active_patients")} value={String(report.activePatients)} tone="info" />
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>{t("billing.monthly_income")}</CardTitle>
                <CardDescription>{`${t("billing.income_total")} vs ${t("billing.pending")} vs ${t("expenses.total")}`}</CardDescription>
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
                      <Bar dataKey="expenses" name={t("expenses.total")} fill="#ef4444" stackId="a" />
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

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t("billing.concept_breakdown")}</CardTitle>
                  <CardDescription>{t("billing.concept_breakdown_desc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {report.conceptBreakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("billing.no_pending")}</p>
                  ) : (
                    <div className="space-y-2">
                      {report.conceptBreakdown.map((cb) => (
                        <div
                          key={cb.concept}
                          className="flex items-center justify-between rounded-md border p-3"
                        >
                          <div>
                            <p className="font-medium">{t(`consultation.concept_${cb.concept}`)}</p>
                            <p className="text-xs text-muted-foreground">
                              {cb.count} {t("consultation.title_single", { count: cb.count }).toLowerCase()}
                            </p>
                          </div>
                          <p className="font-semibold">{MXN(cb.total)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("billing.method_breakdown")}</CardTitle>
                  <CardDescription>{t("billing.method_breakdown_desc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {report.methodBreakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("billing.no_pending")}</p>
                  ) : (
                    <div className="space-y-2">
                      {report.methodBreakdown.map((mb) => (
                        <div
                          key={mb.method}
                          className="flex items-center justify-between rounded-md border p-3"
                        >
                          <div>
                            <p className="font-medium">{t(`consultation.method_${mb.method}`)}</p>
                            <p className="text-xs text-muted-foreground">
                              {mb.count} {t("consultation.title_single", { count: mb.count }).toLowerCase()}
                            </p>
                          </div>
                          <p className="font-semibold">{MXN(mb.total)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
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
  tone: "success" | "warning" | "destructive" | "info";
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

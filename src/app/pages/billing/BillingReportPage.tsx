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

const MXN = (n: number) => formatCurrency(n, "MXN", "es-MX");

/**
 * Reporte financiero (Sprint 14D).
 * - KPIs: ingresos, pendientes, # consultas pagadas, # pacientes activos.
 * - Gráfico Recharts: barras apiladas ingresos vs pendientes por mes.
 * - Top pacientes por total pagado.
 *
 * Restringido a roles `admin` y `facturacion` (RequireRole en el router).
 */
export const BillingReportPage = () => {
  const report = useFinancialReport(180, 6, 5);

  if (report === null) {
    return (
      <>
        <PageHeader title="Reporte financiero" />
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
      ["Mes", "Ingresos", "Pendientes", "# Pagadas", "# Pendientes"].join(","),
      ...report.monthly.map((m) =>
        [m.monthKey, m.income.toFixed(2), m.pending.toFixed(2), m.paidCount, m.pendingCount].join(","),
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
    a.download = `reporte-financiero-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Reporte financiero"
        description={`Últimos 6 meses · ${new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(report.rangeStart)} → ${new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(report.rangeEnd)}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/billing">
                <TrendingUp className="mr-2 h-4 w-4" />
                Pendientes
              </Link>
            </Button>
            <Button onClick={onExport} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        }
      />
      <PageContent>
        <div className="grid gap-4 sm:grid-cols-4">
          <Kpi title="Ingresos" value={MXN(report.totalIncome)} tone="success" />
          <Kpi title="Pendiente" value={MXN(report.totalPending)} tone="warning" />
          <Kpi title="Consultas pagadas" value={String(report.paidCount)} tone="info" />
          <Kpi title="Pacientes activos" value={String(report.activePatients)} tone="info" />
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Tendencia mensual</CardTitle>
            <CardDescription>Ingresos vs pendiente (últimos 6 meses)</CardDescription>
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
                  <Bar dataKey="income" name="Ingresos" fill="#10b981" stackId="a" />
                  <Bar dataKey="pending" name="Pendiente" fill="#f59e0b" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Top pacientes</CardTitle>
            <CardDescription>Los 5 pacientes con mayor ingreso pagado</CardDescription>
          </CardHeader>
          <CardContent>
            {report.topPatients.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay pagos registrados en el rango.
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
                          {p.consultations} consulta{p.consultations === 1 ? "" : "s"}
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

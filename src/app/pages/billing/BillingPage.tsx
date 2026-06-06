import { useMemo, useState } from "react";
import {
  DollarSign,
  Receipt,
  Download,
  AlertCircle,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Badge } from "@components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@components/ui/table";
import { EmptyState } from "@components/layout/EmptyState";
import {
  usePendingPayments,
  type PendingPaymentItem,
} from "@modules/consultation/ui/useBillingHooks";
import { MarkAsPaidDialog } from "@modules/consultation/ui/MarkAsPaidDialog";
import type { Consultation } from "@modules/consultation/domain/Consultation";
import { formatCurrency } from "@utils/formatCurrency";

const MXN = (n: number) => formatCurrency(n, "MXN", "es-MX");

const toIsoInputDate = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Lista de pagos pendientes (Sprint 14D).
 * - Filtros: rango de fecha, búsqueda por paciente.
 * - Botón "Marcar pagada" inline abre el MarkAsPaidDialog.
 * - "Recibo" navega a /billing/:id/receipt para los ya pagados (no aplica aquí).
 */
export const BillingPage = () => {
  const today = useMemo(() => new Date(), []);
  const initialFrom = useMemo(() => {
    const d = new Date(today);
    d.setMonth(d.getMonth() - 6);
    return d;
  }, [today]);

  const [from, setFrom] = useState<Date>(initialFrom);
  const [to, setTo] = useState<Date>(today);
  const [query, setQuery] = useState("");
  const [paidTarget, setPaidTarget] = useState<Consultation | null>(null);

  const { items, total, totalAmount } = usePendingPayments({
    from,
    to,
    patientQuery: query,
  });

  const onExportCsv = () => {
    if (items.length === 0) {
      toast.info("No hay pagos pendientes para exportar");
      return;
    }
    const lines = [
      ["Fecha", "Paciente", "Consulta #", "Motivo", "Costo (MXN)"].join(","),
      ...items.map((it) =>
        [
          it.consultation.consultationDate.toISOString().slice(0, 10),
          `"${it.patientName.replace(/"/g, '""')}"`,
          it.consultation.consultationNumber,
          `"${it.consultation.reason.replace(/"/g, '""')}"`,
          it.consultation.cost.toFixed(2),
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pendientes-${toIsoInputDate(today)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Facturación · Pagos pendientes"
        description="Consultas con costo registrado que aún no han sido pagadas."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/billing/report">
                <Receipt className="mr-2 h-4 w-4" />
                Reporte financiero
              </Link>
            </Button>
            <Button onClick={onExportCsv} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </>
        }
      />
      <PageContent>
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <KpiCard title="Pendientes" value={String(total)} tone="warning" />
          <KpiCard title="Monto total" value={MXN(totalAmount)} tone="destructive" />
          <KpiCard
            title="Rango"
            value={`${toIsoInputDate(from)} → ${toIsoInputDate(to)}`}
            tone="info"
          />
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Acota la lista por fecha o por paciente.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="from">Desde</Label>
                <Input
                  id="from"
                  type="date"
                  value={toIsoInputDate(from)}
                  onChange={(e) => setFrom(e.target.value ? new Date(e.target.value) : initialFrom)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="to">Hasta</Label>
                <Input
                  id="to"
                  type="date"
                  value={toIsoInputDate(to)}
                  onChange={(e) => setTo(e.target.value ? new Date(e.target.value) : today)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="q">Buscar paciente</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="q"
                    className="pl-8"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nombre o apellido"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {items.length === 0 ? (
          <EmptyState
            icon={AlertCircle}
            title="Sin pagos pendientes"
            description="No hay consultas con pago pendiente en el rango seleccionado."
          />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <PendingRow
                    key={it.consultation.id.toString()}
                    item={it}
                    onMark={() => setPaidTarget(it.consultation)}
                  />
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </PageContent>
      <MarkAsPaidDialog
        open={!!paidTarget}
        consultation={paidTarget}
        onClose={() => setPaidTarget(null)}
        onSaved={() => {
          setPaidTarget(null);
          toast.success("Pago registrado");
        }}
      />
    </>
  );
};

const KpiCard = ({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "warning" | "destructive" | "info";
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

const PendingRow = ({
  item,
  onMark,
}: {
  item: PendingPaymentItem;
  onMark: () => void;
}) => (
  <TableRow>
    <TableCell>
      {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(
        item.consultation.consultationDate,
      )}
    </TableCell>
    <TableCell>{item.patientName}</TableCell>
    <TableCell className="max-w-md truncate" title={item.consultation.reason}>
      {item.consultation.reason}
    </TableCell>
    <TableCell className="text-right font-medium">
      {MXN(item.consultation.cost)}
    </TableCell>
    <TableCell className="text-right">
      <Button size="sm" onClick={onMark} data-testid={`row-mark-${item.consultation.id.toString()}`}>
        <DollarSign className="mr-1 h-4 w-4" />
        Marcar pagada
      </Button>
    </TableCell>
  </TableRow>
);

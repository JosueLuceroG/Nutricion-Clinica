import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n/config";
import {
  DollarSign,
  Receipt,
  Download,
  AlertCircle,
  Search,
  XCircle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import { EmptyState } from "@components/layout/EmptyState";
import { ConfirmDialog } from "@components/layout/ConfirmDialog";
import {
  usePendingPayments,
  type PendingPaymentItem,
} from "@modules/consultation/ui/useBillingHooks";
import { MarkAsPaidDialog } from "@modules/consultation/ui/MarkAsPaidDialog";
import type { Consultation } from "@modules/consultation/domain/Consultation";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from "@modules/consultation/domain/PaymentStatus";
import { formatCurrency } from "@utils/formatCurrency";
import { consultationService } from "@services/consultationService";

const MXN = (n: number) => formatCurrency(n, "MXN", i18n.language);

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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paidTarget, setPaidTarget] = useState<Consultation | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PendingPaymentItem | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPaying, setBulkPaying] = useState(false);
  const { t } = useTranslation();

  const { items, total } = usePendingPayments({
    from,
    to,
    patientQuery: query,
  });

  const filteredItems = useMemo(
    () =>
      statusFilter === "all"
        ? items
        : items.filter((it) => it.paymentStatus === statusFilter),
    [items, statusFilter],
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((it) => it.consultation.id.toString())));
    }
  };

  const onBulkPay = async () => {
    const selected = filteredItems.filter((it) => selectedIds.has(it.consultation.id.toString()));
    if (selected.length === 0) return;
    setBulkPaying(true);
    try {
      await Promise.all(
        selected.map((it) =>
          consultationService.payment.register(it.consultation.id, {
            paid: true,
            paymentStatus: "paid",
            paymentMethod: "cash",
            paidAt: new Date(),
            amountPaid: it.consultation.cost,
          }),
        ),
      );
      toast.success(t("billing.bulk_paid", { count: selected.length }));
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(t("common.error_occurred"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBulkPaying(false);
    }
  };

  const onCancelPayment = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await consultationService.payment.register(cancelTarget.consultation.id, {
        paid: false,
        paymentStatus: "cancelled",
        paymentMethod: null,
        paidAt: null,
      });
      toast.success(t("billing.payment_cancelled"));
      setCancelTarget(null);
    } catch (err) {
      toast.error(t("common.error_occurred"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setCancelling(false);
    }
  };

  const onExportCsv = () => {
    if (items.length === 0) {
      toast.info(t("billing.no_pending"));
      return;
    }
    const headerRow = [
      t("common.date"), t("common.patient"), t("billing.csv_consultation_number"),
      t("consultation.reason"), t("billing.column_status"), t("billing.column_cost"),
      t("billing.remaining"),
    ];
    const lines = [
      headerRow.join(","),
      ...filteredItems.map((it) =>
        [
          it.consultation.consultationDate.toISOString().slice(0, 10),
          `"${it.patientName.replace(/"/g, '""')}"`,
          it.consultation.consultationNumber,
          `"${it.consultation.reason.replace(/"/g, '""')}"`,
          it.paymentStatus,
          it.consultation.cost.toFixed(2),
          it.remainingAmount.toFixed(2),
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t("billing.pending_filename")}-${toIsoInputDate(today)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title={`${t("billing.title")} · ${t("billing.pending_payments")}`}
        description={t("billing.pending_consultations")}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/billing/report">
                <Receipt className="mr-2 h-4 w-4" />
                {t("billing.report_title")}
              </Link>
            </Button>
            <Button onClick={onExportCsv} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              {t("billing.export_csv")}
            </Button>
          </>
        }
      />
      <PageContent>
        <div className="mb-4 grid gap-4 sm:grid-cols-4">
          <KpiCard title={t("billing.pending")} value={String(filteredItems.length)} tone="warning" />
          <KpiCard title={t("billing.remaining_total")} value={MXN(
            filteredItems.reduce((s, it) => s + it.remainingAmount, 0),
          )} tone="destructive" />
          <KpiCard title={t("billing.from")} value={`${toIsoInputDate(from)} → ${toIsoInputDate(to)}`} tone="info" />
          <KpiCard title={t("billing.filtered")} value={total !== filteredItems.length ? `${filteredItems.length}/${total}` : String(total)} tone="info" />
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{t("common.filter")}</CardTitle>
            <CardDescription>{t("billing.filter_by_date")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="from">{t("billing.from")}</Label>
                <Input
                  id="from"
                  type="date"
                  value={toIsoInputDate(from)}
                  onChange={(e) => setFrom(e.target.value ? new Date(e.target.value) : initialFrom)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="to">{t("billing.to")}</Label>
                <Input
                  id="to"
                  type="date"
                  value={toIsoInputDate(to)}
                  onChange={(e) => setTo(e.target.value ? new Date(e.target.value) : today)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="q">{t("billing.search_patient")}</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="q"
                    className="pl-8"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("billing.search_patient")}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="status-filter">{t("billing.column_status")}</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("common.all")}</SelectItem>
                    <SelectItem value="pending">{PAYMENT_STATUS_LABELS.pending}</SelectItem>
                    <SelectItem value="partial">{PAYMENT_STATUS_LABELS.partial}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {filteredItems.length === 0 ? (
          <EmptyState
            icon={AlertCircle}
            title={t("billing.no_pending")}
            description={t("billing.pending_consultations")}
          />
        ) : (
          <Card>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 border-b px-4 py-2">
                <span className="text-sm text-muted-foreground">
                  {t("billing.selected_count", { count: selectedIds.size })}
                </span>
                <Button size="sm" onClick={onBulkPay} disabled={bulkPaying}>
                  {bulkPaying ? t("common.saving") : t("billing.bulk_pay")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  {t("common.clear")}
                </Button>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                      onChange={toggleSelectAll}
                      aria-label={t("common.select_all")}
                    />
                  </TableHead>
                  <TableHead>{t("billing.column_date")}</TableHead>
                  <TableHead>{t("billing.column_patient")}</TableHead>
                  <TableHead>{t("consultation.reason")}</TableHead>
                  <TableHead>{t("billing.column_status")}</TableHead>
                  <TableHead className="text-right">{t("billing.column_cost")}</TableHead>
                  <TableHead className="text-right">{t("billing.remaining")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((it) => (
                  <PendingRow
                    key={it.consultation.id.toString()}
                    item={it}
                    selected={selectedIds.has(it.consultation.id.toString())}
                    onToggle={() => toggleSelect(it.consultation.id.toString())}
                    onMark={() => setPaidTarget(it.consultation)}
                    onCancel={() => setCancelTarget(it)}
                  />
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </PageContent>
      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(o) => { if (!o) setCancelTarget(null); }}
        title={t("billing.cancel_payment_title")}
        description={t("billing.cancel_payment_desc")}
        confirmLabel={t("billing.confirm_cancel")}
        tone="danger"
        busy={cancelling}
        onConfirm={onCancelPayment}
      />

      <MarkAsPaidDialog
        open={!!paidTarget}
        consultation={paidTarget}
        onClose={() => setPaidTarget(null)}
        onSaved={() => {
          setPaidTarget(null);
          toast.success(t("billing.pay"));
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
  selected,
  onToggle,
  onMark,
  onCancel,
}: {
  item: PendingPaymentItem;
  selected?: boolean;
  onToggle: () => void;
  onMark: () => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslation();
  const statusColor = PAYMENT_STATUS_COLORS[item.paymentStatus as keyof typeof PAYMENT_STATUS_COLORS] ?? "warning";
  const statusLabel = PAYMENT_STATUS_LABELS[item.paymentStatus as keyof typeof PAYMENT_STATUS_LABELS] ?? item.paymentStatus;
  return (
  <TableRow>
    <TableCell>
      <input
        type="checkbox"
        className="h-4 w-4"
        checked={!!selected}
        onChange={onToggle}
        aria-label={`${t("common.select")} ${item.patientName}`}
      />
    </TableCell>
    <TableCell>
      {new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
        item.consultation.consultationDate,
      )}
    </TableCell>
    <TableCell>{item.patientName}</TableCell>
    <TableCell className="max-w-md truncate" title={item.consultation.reason}>
      {item.consultation.reason}
    </TableCell>
    <TableCell>
      <Badge variant={statusColor}>{statusLabel}</Badge>
    </TableCell>
    <TableCell className="text-right font-medium">
      {MXN(item.consultation.cost)}
    </TableCell>
    <TableCell className="text-right font-medium text-muted-foreground">
      {item.remainingAmount < item.consultation.cost ? MXN(item.remainingAmount) : "—"}
    </TableCell>
    <TableCell className="text-right">
      <div className="flex items-center justify-end gap-1">
        <Button size="sm" onClick={onMark} data-testid={`row-mark-${item.consultation.id.toString()}`}>
          <DollarSign className="mr-1 h-4 w-4" />
          {item.paymentStatus === "partial" ? t("billing.complete_payment") : t("billing.pay")}
        </Button>
        {item.paymentStatus === "partial" && (
          <Button size="sm" variant="ghost" onClick={onCancel} title={t("billing.cancel_payment")}>
            <XCircle className="h-4 w-4" />
          </Button>
        )}
      </div>
    </TableCell>
  </TableRow>
  );
};

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n/config";
import { Link, useSearchParams } from "react-router-dom";
import { DollarSign, Receipt, Search, TrendingUp, Download } from "lucide-react";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Badge } from "@components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@components/ui/table";
import { EmptyState } from "@components/layout/EmptyState";
import { usePaymentsHistory } from "@modules/consultation/ui/useBillingHooks";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from "@modules/consultation/domain/PaymentStatus";
import { formatCurrency } from "@utils/formatCurrency";

const MXN = (n: number) => formatCurrency(n, "MXN", i18n.language);

const toIsoInputDate = (d: Date): string => d.toISOString().slice(0, 10);

export const PaymentsPage = () => {
  const today = useMemo(() => new Date(), []);
  const initialFrom = useMemo(() => {
    const d = new Date(today);
    d.setMonth(d.getMonth() - 6);
    return d;
  }, [today]);
  const { t } = useTranslation();

  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get("patientId") ?? "";
  const [from, setFrom] = useState<Date>(initialFrom);
  const [to, setTo] = useState<Date>(today);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { items, total, totalIncome, totalPending } = usePaymentsHistory({
    from,
    to,
    patientQuery: query,
    paymentStatus: statusFilter,
    patientIdFilter: initialPatientId || undefined,
  });

  const onExportCsv = () => {
    if (items.length === 0) return;
    const lines = [
      [
        t("billing.column_date"), t("billing.column_patient"), t("consultation.reason"),
        t("consultation.payment_concept"), t("billing.column_status"), t("billing.column_cost"),
        t("consultation.amount_paid"),
      ].join(","),
      ...items.map((it) =>
        [
          it.consultation.consultationDate.toISOString().slice(0, 10),
          `"${it.patientName.replace(/"/g, '""')}"`,
          `"${it.consultation.reason.replace(/"/g, '""')}"`,
          it.paymentConcept,
          it.paymentStatus,
          it.consultation.cost.toFixed(2),
          it.amountPaid.toFixed(2),
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pagos-${toIsoInputDate(today)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title={t("billing.payments_title")}
        description={t("billing.payments_description")}
        actions={
          <>
            <Button onClick={onExportCsv} variant="outline" disabled={items.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              {t("billing.export_csv")}
            </Button>
            <Button asChild variant="outline">
              <Link to="/billing/report">
                <TrendingUp className="mr-2 h-4 w-4" />
                {t("billing.report_title")}
              </Link>
            </Button>
          </>
        }
      />
      <PageContent>
        <div className="mb-4 grid gap-4 sm:grid-cols-4">
          <KpiCard title={t("billing.total_transactions")} value={String(total)} tone="info" />
          <KpiCard title={t("billing.income_total")} value={MXN(totalIncome)} tone="success" />
          <KpiCard title={t("billing.pending_collection")} value={MXN(totalPending)} tone="warning" />
          <KpiCard title={t("billing.net_income")} value={MXN(totalIncome - totalPending)} tone={totalIncome >= totalPending ? "success" : "destructive"} />
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{t("common.filter")}</CardTitle>
            <CardDescription>{t("billing.filter_by_date")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="pfrom">{t("billing.from")}</Label>
                <Input
                  id="pfrom"
                  type="date"
                  value={toIsoInputDate(from)}
                  onChange={(e) => setFrom(e.target.value ? new Date(e.target.value) : initialFrom)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pto">{t("billing.to")}</Label>
                <Input
                  id="pto"
                  type="date"
                  value={toIsoInputDate(to)}
                  onChange={(e) => setTo(e.target.value ? new Date(e.target.value) : today)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pq">{t("billing.search_patient")}</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="pq"
                    className="pl-8"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("billing.search_patient")}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pstatus">{t("billing.column_status")}</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="pstatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("common.all")}</SelectItem>
                    <SelectItem value="paid">{PAYMENT_STATUS_LABELS.paid}</SelectItem>
                    <SelectItem value="partial">{PAYMENT_STATUS_LABELS.partial}</SelectItem>
                    <SelectItem value="pending">{PAYMENT_STATUS_LABELS.pending}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {items.length === 0 ? (
          <EmptyState icon={Receipt} title={t("common.no_results")} description={t("billing.payments_empty")} />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("billing.column_date")}</TableHead>
                  <TableHead>{t("billing.column_patient")}</TableHead>
                  <TableHead>{t("consultation.reason")}</TableHead>
                  <TableHead>{t("consultation.payment_concept")}</TableHead>
                  <TableHead>{t("billing.column_status")}</TableHead>
                  <TableHead className="text-right">{t("billing.column_cost")}</TableHead>
                  <TableHead className="text-right">{t("consultation.amount_paid")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => {
                  const ps = it.paymentStatus as keyof typeof PAYMENT_STATUS_COLORS;
                  return (
                    <TableRow key={it.consultation.id.toString()}>
                      <TableCell>
                        {new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
                          it.consultation.consultationDate,
                        )}
                      </TableCell>
                      <TableCell>
                        <Link to={`/pacientes/${it.patientId}`} className="font-medium hover:underline">
                          {it.patientName}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={it.consultation.reason}>
                        {it.consultation.reason}
                      </TableCell>
                      <TableCell>
                        {t(`consultation.concept_${it.paymentConcept}`)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={PAYMENT_STATUS_COLORS[ps] ?? "secondary"}>
                          {PAYMENT_STATUS_LABELS[ps] ?? it.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {MXN(it.consultation.cost)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {it.amountPaid > 0 ? MXN(it.amountPaid) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/consultas/${it.consultation.id.toString()}`}>
                            <DollarSign className="mr-1 h-4 w-4" />
                            {t("common.view_details")}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </PageContent>
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
  tone: "success" | "warning" | "destructive" | "info";
}) => (
  <Card>
    <CardHeader className="pb-2">
      <CardDescription className="text-xs uppercase tracking-wider">{title}</CardDescription>
      <CardTitle className="text-2xl">
        <Badge variant={tone}>{value}</Badge>
      </CardTitle>
    </CardHeader>
  </Card>
);

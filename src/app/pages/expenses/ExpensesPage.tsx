import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n/config";
import { Plus, Download, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from "@modules/expense/domain/ExpenseCategory";
import { useExpenses } from "@modules/expense/ui/useExpenseHooks";
import { expenseService } from "@services/expenseService";
import { ExpenseDialog } from "./ExpenseDialog";
import type { Expense } from "@modules/expense/domain/Expense";
import { formatCurrency } from "@utils/formatCurrency";

const MXN = (n: number) => formatCurrency(n, "MXN", i18n.language);

const toIsoDateInput = (d: Date): string => d.toISOString().slice(0, 10);

export const ExpensesPage = () => {
  const today = useMemo(() => new Date(), []);
  const initialFrom = useMemo(() => {
    const d = new Date(today);
    d.setMonth(d.getMonth() - 3);
    return d;
  }, [today]);

  const [from, setFrom] = useState<Date>(initialFrom);
  const [to, setTo] = useState<Date>(today);
  const [category, setCategory] = useState<ExpenseCategory | "all">("all");
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const { t } = useTranslation();

  const items = useExpenses({
    category: category === "all" ? undefined : category,
    from,
    to,
  });

  const totalAmount = useMemo(() => items.reduce((sum, e) => sum + e.amount, 0), [items]);

  const onExportCsv = () => {
    if (items.length === 0) {
      toast.info(t("expenses.no_data"));
      return;
    }
    const lines = [
      ["Fecha", "Concepto", "Categoría", "Monto MXN", "Notas"].join(","),
      ...items.map((e) =>
        [
          toIsoDateInput(e.fecha),
          `"${e.concept.replace(/"/g, '""')}"`,
          EXPENSE_CATEGORY_LABELS[e.category],
          e.amount.toFixed(2),
          `"${(e.notes ?? "").replace(/"/g, '""')}"`,
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gastos-${toIsoDateInput(today)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (expense: Expense) => {
    try {
      await expenseService.delete.execute(expense.id);
      toast.success(t("common.deleted"));
    } catch {
      toast.error(t("common.error_occurred"));
    }
  };

  return (
    <>
      <PageHeader
        title={t("expenses.title")}
        actions={
          <>
            <Button onClick={onExportCsv} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              {t("billing.export_csv")}
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("expenses.add")}
            </Button>
          </>
        }
      />
      <PageContent>
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wider">
                {t("expenses.count")}
              </CardDescription>
              <CardTitle className="text-2xl">{items.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wider">
                {t("expenses.total")}
              </CardDescription>
              <CardTitle className="text-2xl">
                <Badge variant="destructive">{MXN(totalAmount)}</Badge>
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-wider">
                {t("billing.from")}
              </CardDescription>
              <CardTitle className="text-lg">
                {toIsoDateInput(from)} → {toIsoDateInput(to)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{t("common.filter")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="efrom">{t("billing.from")}</Label>
                <Input
                  id="efrom"
                  type="date"
                  value={toIsoDateInput(from)}
                  onChange={(e) => setFrom(e.target.value ? new Date(e.target.value) : initialFrom)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="eto">{t("billing.to")}</Label>
                <Input
                  id="eto"
                  type="date"
                  value={toIsoDateInput(to)}
                  onChange={(e) => setTo(e.target.value ? new Date(e.target.value) : today)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ecat">{t("expenses.category")}</Label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as ExpenseCategory | "all")}
                >
                  <SelectTrigger id="ecat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("common.all")}</SelectItem>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {EXPENSE_CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {items.length === 0 ? (
          <EmptyState
            icon={AlertCircle}
            title={t("expenses.no_data")}
            description={t("expenses.no_data_desc")}
          />
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>{t("expenses.concept")}</TableHead>
                  <TableHead>{t("expenses.category")}</TableHead>
                  <TableHead className="text-right">{t("expenses.amount")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((e) => (
                  <TableRow key={e.id.toString()}>
                    <TableCell>
                      {new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(e.fecha)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={e.concept}>
                      {e.concept}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{EXPENSE_CATEGORY_LABELS[e.category]}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {MXN(e.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditTarget(e)}
                        >
                          {t("common.edit")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </PageContent>

      <ExpenseDialog
        open={showCreate || !!editTarget}
        expense={editTarget}
        onClose={() => { setShowCreate(false); setEditTarget(null); }}
        onSaved={() => {
          setShowCreate(false);
          setEditTarget(null);
          toast.success(t("common.saved"));
        }}
      />
    </>
  );
};

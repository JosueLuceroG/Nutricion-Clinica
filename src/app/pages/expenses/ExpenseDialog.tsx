import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import { Label } from "@components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
} from "@modules/expense/domain/ExpenseCategory";
import type { Expense } from "@modules/expense/domain/Expense";
import { expenseService } from "@services/expenseService";

export interface ExpenseDialogProps {
  open: boolean;
  expense: Expense | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  fecha: string;
  concept: string;
  amount: string;
  category: ExpenseCategory;
  notes: string;
}

const defaultForm = (e: Expense | null): FormState => ({
  fecha: e
    ? new Date(e.fecha).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10),
  concept: e?.concept ?? "",
  amount: e ? String(e.amount) : "",
  category: e?.category ?? "otro",
  notes: e?.notes ?? "",
});

export const ExpenseDialog = ({ open, expense, onClose, onSaved }: ExpenseDialogProps) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(defaultForm(expense));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(defaultForm(expense));
      setError(null);
    }
  }, [open, expense]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const conceptTrim = form.concept.trim();
    if (!conceptTrim || conceptTrim.length < 2) {
      setError(t("expenses.concept_required"));
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError(t("expenses.amount_invalid"));
      return;
    }
    const fecha = form.fecha ? new Date(form.fecha) : null;
    if (!fecha || Number.isNaN(fecha.getTime())) {
      setError(t("expenses.date_required"));
      return;
    }

    setBusy(true);
    try {
      if (expense) {
        await expenseService.update.execute(expense.id, {
          fecha,
          concept: conceptTrim,
          amount,
          category: form.category,
          notes: form.notes.trim() || null,
        });
      } else {
        await expenseService.create.execute({
          fecha,
          concept: conceptTrim,
          amount,
          currency: "MXN",
          category: form.category,
          notes: form.notes.trim() || null,
        });
      }
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("common.error_occurred");
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {expense ? t("expenses.edit") : t("expenses.add")}
          </DialogTitle>
        </DialogHeader>
        <form id="expense-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ef-date">{t("common.date")}</Label>
              <Input
                id="ef-date"
                type="date"
                value={form.fecha}
                onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ef-category">{t("expenses.category")}</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v as ExpenseCategory }))}
              >
                <SelectTrigger id="ef-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {EXPENSE_CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="ef-concept">{t("expenses.concept")}</Label>
            <Input
              id="ef-concept"
              value={form.concept}
              onChange={(e) => setForm((f) => ({ ...f, concept: e.target.value }))}
              required
              placeholder="Ej. Compra de báscula"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="ef-amount">{t("expenses.amount")} (MXN)</Label>
            <Input
              id="ef-amount"
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="ef-notes">{t("common.notes")}</Label>
            <Textarea
              id="ef-notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="expense-form" disabled={busy}>
            {busy ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

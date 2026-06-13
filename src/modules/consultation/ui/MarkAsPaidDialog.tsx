import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import { Label } from "@components/ui/label";
import {
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@modules/consultation/domain/PaymentMethod";
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
} from "@modules/consultation/domain/PaymentStatus";
import {
  PAYMENT_CONCEPTS,
  PAYMENT_CONCEPT_LABELS,
  type PaymentConcept,
} from "@modules/consultation/domain/PaymentConcept";
import type { Consultation } from "@modules/consultation/domain/Consultation";
import { consultationService } from "@services/consultationService";

export interface MarkAsPaidDialogProps {
  open: boolean;
  consultation: Consultation | null;
  onClose: () => void;
  onSaved: (updated: Consultation) => void;
}

interface FormState {
  cost: string;
  paymentStatus: PaymentStatus;
  paymentConcept: PaymentConcept;
  amountPaid: string;
  paymentMethod: PaymentMethod;
  paidAt: string;
  reference: string;
  invoiceNumber: string;
  billingNotes: string;
}

const toIsoDateInput = (d: Date | null | undefined): string => {
  const date = d ?? new Date();
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const defaultForm = (c: Consultation | null): FormState => ({
  cost: c && c.cost > 0 ? String(c.cost) : "",
  paymentStatus: c?.isPaid ? c.paymentStatus : "paid",
  paymentConcept: c?.paymentConcept ?? "consulta",
  amountPaid: c && c.amountPaid > 0 ? String(c.amountPaid) : (c?.cost && c.cost > 0 ? String(c.cost) : ""),
  paymentMethod: c?.paymentMethod ?? "cash",
  paidAt: toIsoDateInput(c?.paidAt ?? new Date()),
  reference: c?.reference ?? "",
  invoiceNumber: c?.invoiceNumber ?? "",
  billingNotes: c?.billingNotes ?? "",
});

const submitLockRef = { current: false } as { current: boolean };

/**
 * Modal para registrar o actualizar el pago de una consulta.
 * Si la consulta ya estaba pagada, precarga los valores.
 * Usa el mismo patrón de guard anti-double-submit que PatientForm.
 */
export const MarkAsPaidDialog = ({
  open,
  consultation,
  onClose,
  onSaved,
}: MarkAsPaidDialogProps) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(() => defaultForm(consultation));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(defaultForm(consultation));
      setError(null);
    }
  }, [open, consultation]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    try {
      if (!consultation) return;
      setError(null);

      const costRaw = form.cost.trim();
      if (costRaw === "") {
        setError(t("consultation.cost") + " " + t("errors.required").toLowerCase());
        return;
      }
      const cost = Number(costRaw);
      if (!Number.isFinite(cost) || cost < 0) {
        setError(t("consultation.cost") + " " + t("errors.must_be_integer").toLowerCase());
        return;
      }

      const paidAtDate = form.paidAt ? new Date(form.paidAt) : null;
      if (!paidAtDate || Number.isNaN(paidAtDate.getTime())) {
        setError(t("consultation.payment_date") + " " + t("errors.required").toLowerCase());
        return;
      }

      const isPaid = form.paymentStatus === "paid" || form.paymentStatus === "partial";
      const amountPaidRaw = form.amountPaid?.trim();
      const amountPaid = amountPaidRaw ? Number(amountPaidRaw) : 0;

      setBusy(true);
      const updated = await consultationService.payment.register(consultation.id, {
        cost,
        paid: isPaid,
        paymentStatus: form.paymentStatus,
        paymentConcept: form.paymentConcept,
        amountPaid: amountPaid || (isPaid ? cost : 0),
        paymentMethod: isPaid ? form.paymentMethod : null,
        paidAt: isPaid ? paidAtDate : null,
        reference: form.reference.trim() || null,
        invoiceNumber: form.invoiceNumber.trim() || null,
        billingNotes: form.billingNotes.trim() || null,
      });
      onSaved(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("common.error_occurred");
      setError(msg);
    } finally {
      setBusy(false);
      submitLockRef.current = false;
    }
  };

  return (
    <Dialog
      open={open && !!consultation}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("consultation.register_payment")}</DialogTitle>
          <DialogDescription>
            {consultation
              ? `${t("consultation.consultation_number", { number: consultation.consultationNumber })} — ${consultation.reason}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <form id="mark-paid-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="paid-cost">{t("consultation.cost")} (MXN)</Label>
              <Input
                id="paid-cost"
                type="number"
                step="0.01"
                min="0"
                value={form.cost}
                onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                required
                data-testid="paid-cost"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="paid-status">{t("consultation.payment_status")}</Label>
              <Select
                value={form.paymentStatus}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, paymentStatus: v as PaymentStatus }))
                }
              >
                <SelectTrigger id="paid-status" data-testid="paid-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.filter((s) => s !== "refunded" && s !== "cancelled").map((s) => (
                    <SelectItem key={s} value={s}>
                      {PAYMENT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="paid-concept">{t("consultation.payment_concept")}</Label>
            <Select
              value={form.paymentConcept}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, paymentConcept: v as PaymentConcept }))
              }
            >
              <SelectTrigger id="paid-concept" data-testid="paid-concept">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_CONCEPTS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {PAYMENT_CONCEPT_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="paid-amount">{t("consultation.amount_paid")} (MXN)</Label>
              <Input
                id="paid-amount"
                type="number"
                step="0.01"
                min="0"
                value={form.amountPaid}
                onChange={(e) => setForm((f) => ({ ...f, amountPaid: e.target.value }))}
                data-testid="paid-amount"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="paid-method">{t("consultation.payment_method")}</Label>
              <Select
                value={form.paymentMethod}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, paymentMethod: v as PaymentMethod }))
                }
              >
                <SelectTrigger id="paid-method" data-testid="paid-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`consultation.method_${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="paid-at">{t("consultation.payment_date")}</Label>
              <Input
                id="paid-at"
                type="date"
                value={form.paidAt}
                onChange={(e) => setForm((f) => ({ ...f, paidAt: e.target.value }))}
                required
                data-testid="paid-at"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="paid-reference">{t("common.description")}</Label>
              <Input
                id="paid-reference"
                value={form.reference}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                placeholder="TRF-001 / CAJA-7"
                data-testid="paid-reference"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="paid-invoice">{t("common.optional")} ({t("common.type")})</Label>
            <Input
              id="paid-invoice"
              value={form.invoiceNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, invoiceNumber: e.target.value }))
              }
              placeholder={t("consultation.invoice_placeholder")}
              data-testid="paid-invoice"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="paid-notes">{t("consultation.payment_notes_optional")}</Label>
            <Textarea
              id="paid-notes"
              value={form.billingNotes}
              onChange={(e) =>
                setForm((f) => ({ ...f, billingNotes: e.target.value }))
              }
              rows={2}
              data-testid="paid-notes"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          <p className="text-xs text-gray-500">
            {t("consultation.cfdi_disclaimer_prefix")} <strong>{t("consultation.cfdi_disclaimer_strong")}</strong>. {t("consultation.cfdi_disclaimer_suffix")}
          </p>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="mark-paid-form"
            disabled={busy}
          >
            {busy
              ? t("common.saving")
              : consultation?.paid
                ? t("consultation.update_payment")
                : t("consultation.mark_as_paid")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

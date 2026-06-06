import { useEffect, useState, type FormEvent } from "react";
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
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@modules/consultation/domain/PaymentMethod";
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
        setError("Indica el costo de la consulta.");
        return;
      }
      const cost = Number(costRaw);
      if (!Number.isFinite(cost) || cost < 0) {
        setError("El costo debe ser un número >= 0.");
        return;
      }

      const paidAtDate = form.paidAt ? new Date(form.paidAt) : null;
      if (!paidAtDate || Number.isNaN(paidAtDate.getTime())) {
        setError("Indica la fecha de pago.");
        return;
      }

      setBusy(true);
      const updated = await consultationService.payment.register(consultation.id, {
        cost,
        paid: true,
        paymentMethod: form.paymentMethod,
        paidAt: paidAtDate,
        reference: form.reference.trim() || null,
        invoiceNumber: form.invoiceNumber.trim() || null,
        billingNotes: form.billingNotes.trim() || null,
      });
      onSaved(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo registrar el pago.";
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
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            {consultation
              ? `Consulta #${consultation.consultationNumber} — ${consultation.reason}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <form id="mark-paid-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="paid-cost">Costo (MXN)</Label>
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
              <Label htmlFor="paid-method">Método de pago</Label>
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
                      {PAYMENT_METHOD_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="paid-at">Fecha de pago</Label>
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
              <Label htmlFor="paid-reference">Referencia</Label>
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
            <Label htmlFor="paid-invoice">Nº de factura (opcional)</Label>
            <Input
              id="paid-invoice"
              value={form.invoiceNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, invoiceNumber: e.target.value }))
              }
              placeholder="CFDI no se emite automáticamente"
              data-testid="paid-invoice"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="paid-notes">Notas (opcional)</Label>
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
            Este documento <strong>no es un CFDI</strong>. La facturación
            electrónica ante el SAT es responsabilidad del profesional.
          </p>
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="mark-paid-form"
            disabled={busy}
          >
            {busy
              ? "Guardando…"
              : consultation?.paid
                ? "Actualizar pago"
                : "Marcar pagada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

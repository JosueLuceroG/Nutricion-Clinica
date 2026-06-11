export const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "partial",
  "refunded",
  "cancelled",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const isPaymentStatus = (v: unknown): v is PaymentStatus =>
  typeof v === "string" && (PAYMENT_STATUSES as readonly string[]).includes(v);

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  partial: "Pago parcial",
  refunded: "Reembolsado",
  cancelled: "Cancelado",
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, "warning" | "success" | "info" | "destructive" | "secondary"> = {
  pending: "warning",
  paid: "success",
  partial: "info",
  refunded: "destructive",
  cancelled: "secondary",
};

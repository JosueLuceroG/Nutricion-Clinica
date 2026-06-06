/**
 * Métodos de pago aceptados a nivel consulta (Sprint 14D MVP).
 *
 * Se mapean a `metodo_pago` en la tabla `pagos` (004-facturacion.sql):
 *   - 'cash'      -> 'efectivo'
 *   - 'card'      -> 'tarjeta'
 *   - 'transfer'  -> 'transferencia'
 *   - 'other'     -> 'otro'
 *
 * El sistema NO procesa pagos con tarjeta directamente (RN-ECO-04);
 * registra pagos reportados por el paciente.
 */
export type PaymentMethod = "cash" | "card" | "transfer" | "other";

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "cash",
  "card",
  "transfer",
  "other",
] as const;

export const isPaymentMethod = (v: unknown): v is PaymentMethod =>
  typeof v === "string" && (PAYMENT_METHODS as readonly string[]).includes(v);

/**
 * Etiquetas en español para UI.
 */
export const PAYMENT_METHOD_LABELS: Readonly<Record<PaymentMethod, string>> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  other: "Otro",
};

/**
 * Mapea un valor del cliente (PaymentMethod) al valor de la DB
 * (`metodo_pago` en tabla `pagos`, definido en 004-facturacion.sql).
 * Se usa en sync al insertar pagos a la tabla de pagos cuando se implemente.
 */
export const paymentMethodClientToDb = (m: PaymentMethod): string => {
  switch (m) {
    case "cash":
      return "efectivo";
    case "card":
      return "tarjeta";
    case "transfer":
      return "transferencia";
    case "other":
      return "otro";
  }
};

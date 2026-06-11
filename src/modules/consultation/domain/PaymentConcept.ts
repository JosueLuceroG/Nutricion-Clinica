export const PAYMENT_CONCEPTS = [
  "consulta",
  "plan",
  "receta",
  "documento",
  "otro",
] as const;

export type PaymentConcept = (typeof PAYMENT_CONCEPTS)[number];

export const isPaymentConcept = (v: unknown): v is PaymentConcept =>
  typeof v === "string" && (PAYMENT_CONCEPTS as readonly string[]).includes(v);

export const PAYMENT_CONCEPT_LABELS: Record<PaymentConcept, string> = {
  consulta: "Consulta",
  plan: "Plan de alimentación",
  receta: "Receta",
  documento: "Documento",
  otro: "Otro",
};

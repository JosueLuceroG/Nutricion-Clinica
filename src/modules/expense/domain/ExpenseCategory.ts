export const EXPENSE_CATEGORIES = [
  "insumos",
  "equipo",
  "capacitacion",
  "servicios",
  "renta",
  "transporte",
  "alimentacion",
  "marketing",
  "impuestos",
  "nomina",
  "otro",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const isExpenseCategory = (v: unknown): v is ExpenseCategory =>
  typeof v === "string" && (EXPENSE_CATEGORIES as readonly string[]).includes(v);

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  insumos: "Insumos",
  equipo: "Equipo",
  capacitacion: "Capacitación",
  servicios: "Servicios",
  renta: "Renta",
  transporte: "Transporte",
  alimentacion: "Alimentación",
  marketing: "Marketing",
  impuestos: "Impuestos",
  nomina: "Nómina",
  otro: "Otro",
};

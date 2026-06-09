import { z } from "zod";

export const DocumentTypeSchema = z.enum([
  "clinical_report",
  "meal_plan",
  "shopping_list",
  "recipe_book",
  "consent",
  "referral",
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export const DocumentTypeLabel: Record<DocumentType, string> = {
  clinical_report: "Reporte clínico",
  meal_plan: "Plan de alimentación",
  shopping_list: "Lista de compras",
  recipe_book: "Recetario",
  consent: "Consentimiento",
  referral: "Derivación",
};

export const DocumentStatusSchema = z.enum(["draft", "signed", "delivered", "voided"]);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;
export const DocumentStatusLabel: Record<DocumentStatus, string> = {
  draft: "Borrador",
  signed: "Firmado",
  delivered: "Entregado",
  voided: "Anulado",
};

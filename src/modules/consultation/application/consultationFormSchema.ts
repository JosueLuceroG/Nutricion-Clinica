import { z } from "zod";

/**
 * Esquema Zod para el wizard de consulta.
 * Cubre los 6 pasos:
 *   1) Datos básicos (fecha, motivo)
 *   2) Subjetivo
 *   3) Objetivo (signos vitales + refs opcionales)
 *   4) Laboratorio (ref opcional)
 *   5) Diagnóstico + plan + próxima cita
 *   6) Revisión (no tiene campos propios)
 *
 * Los campos opcionales se validan progresivamente según el paso actual
 * usando `trigger(fields)` de react-hook-form.
 */
const optionalText = (max: number) =>
  z
    .preprocess(
      (v) => (v === null || v === undefined ? "" : v),
      z
        .string()
        .trim()
        .max(max, `Máximo ${max} caracteres`)
        .optional()
        .or(z.literal(""))
        .transform((v) => (v && v.length > 0 ? v : null)),
    );

const vitalField = (min: number, max: number, integer = true) =>
  z.preprocess(
    (v) => (typeof v === "number" && Number.isNaN(v) ? undefined : v),
    integer
      ? z.coerce.number().int().min(min).max(max).optional()
      : z.coerce.number().min(min).max(max).optional(),
  );

const vitalSignsSchema = z
  .object({
    systolicMmHg: vitalField(50, 260, true),
    diastolicMmHg: vitalField(30, 180, true),
    heartRateBpm: vitalField(20, 220, true),
    temperatureC: vitalField(30, 45, false),
  })
  .partial();

export const ConsultationFormSchema = z
  .object({
    consultationDate: z
      .string()
      .min(1, "Requerido")
      .refine((v) => !Number.isNaN(new Date(v).getTime()), "Fecha inválida")
      .refine(
        (v) => new Date(v).getTime() <= Date.now() + 24 * 60 * 60 * 1000,
        "No puede estar más de 1 día en el futuro",
      ),
    reason: z
      .string()
      .trim()
      .min(3, "Mínimo 3 caracteres")
      .max(500, "Máximo 500 caracteres"),
    subjective: optionalText(4000),
    objective: optionalText(4000),
    vitalsTaken: z.boolean().default(false),
    vitalSigns: vitalSignsSchema.optional(),
    assessment: optionalText(4000),
    plan: optionalText(4000),
    anthropometryId: z.string().optional().or(z.literal("")),
    labPanelId: z.string().optional().or(z.literal("")),
    nextVisitDate: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z
        .string()
        .optional()
        .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), "Fecha inválida")
        .refine(
          (v) => !v || new Date(v).getTime() >= Date.now() - 24 * 60 * 60 * 1000,
          "La próxima cita no puede estar en el pasado",
        ),
    ),
  })
  .strict();

export type ConsultationFormValues = z.infer<typeof ConsultationFormSchema>;

export const consultationFormDefaultValues: ConsultationFormValues = {
  consultationDate: new Date().toISOString().slice(0, 10),
  reason: "",
  subjective: null,
  objective: null,
  vitalsTaken: false,
  vitalSigns: {},
  assessment: null,
  plan: null,
  anthropometryId: "",
  labPanelId: "",
  nextVisitDate: "",
};

export const WIZARD_STEPS = [
  { id: 1, key: "basics", title: "Datos básicos", fields: ["consultationDate", "reason"] as const },
  { id: 2, key: "subjective", title: "Subjetivo", fields: ["subjective"] as const },
  { id: 3, key: "objective", title: "Objetivo", fields: ["vitalsTaken", "objective"] as const },
  { id: 4, key: "lab", title: "Laboratorio", fields: ["labPanelId"] as const },
  { id: 5, key: "plan", title: "Diagnóstico y plan", fields: ["assessment", "plan", "nextVisitDate"] as const },
  { id: 6, key: "review", title: "Revisión", fields: [] as readonly string[] },
] as const;

export type WizardStepKey = (typeof WIZARD_STEPS)[number]["key"];

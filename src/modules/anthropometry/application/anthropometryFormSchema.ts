import { z } from "zod";
import { SexSchema } from "@modules/patient/domain/Sex";

const optionalCm = z
  .union([
    z.literal(""),
    z.coerce
      .number({ invalid_type_error: "Debe ser un número" })
      .positive("Debe ser positivo")
      .min(1, "Mínimo 1 cm")
      .max(300, "Máximo 300 cm"),
  ])
  .optional();

const optionalMm = z
  .union([
    z.literal(""),
    z.coerce
      .number({ invalid_type_error: "Debe ser un número" })
      .nonnegative("No puede ser negativo")
      .min(0, "Mínimo 0 mm")
      .max(80, "Máximo 80 mm"),
  ])
  .optional();

export const AnthropometryFormSchema = z.object({
  measuredAt: z
    .string()
    .min(1, "Requerido")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Fecha inválida")
    .refine(
      (v) => new Date(v).getTime() <= Date.now() + 24 * 60 * 60 * 1000,
      "No puede estar en el futuro",
    ),
  weightKg: z.coerce
    .number({ invalid_type_error: "Requerido" })
    .positive("Debe ser positivo")
    .min(1, "Mínimo 1 kg")
    .max(500, "Máximo 500 kg"),
  heightCm: z.coerce
    .number({ invalid_type_error: "Requerido" })
    .positive("Debe ser positivo")
    .min(50, "Mínimo 50 cm")
    .max(250, "Máximo 250 cm"),
  sex: SexSchema,
  ageYears: z.coerce
    .number({ invalid_type_error: "Debe ser un número" })
    .int("Debe ser un entero")
    .min(0, "Mínimo 0 años")
    .max(130, "Máximo 130 años"),
  neck: optionalCm,
  chest: optionalCm,
  waist: optionalCm,
  hip: optionalCm,
  arm: optionalCm,
  forearm: optionalCm,
  thigh: optionalCm,
  calf: optionalCm,
  triceps: optionalMm,
  biceps: optionalMm,
  subscapular: optionalMm,
  suprailiac: optionalMm,
  abdominal: optionalMm,
  thigh_skinfold: optionalMm,
  calf_skinfold: optionalMm,
  notes: z.string().max(2000, "Máximo 2000 caracteres").optional().or(z.literal("")),
});

export type AnthropometryFormValues = z.infer<typeof AnthropometryFormSchema>;

export const anthropometryFormDefaultValues: AnthropometryFormValues = {
  measuredAt: new Date().toISOString().slice(0, 10),
  weightKg: "" as never,
  heightCm: "" as never,
  sex: "undisclosed",
  ageYears: 0,
  neck: "",
  chest: "",
  waist: "",
  hip: "",
  arm: "",
  forearm: "",
  thigh: "",
  calf: "",
  triceps: "",
  biceps: "",
  subscapular: "",
  suprailiac: "",
  abdominal: "",
  thigh_skinfold: "",
  calf_skinfold: "",
  notes: "",
};

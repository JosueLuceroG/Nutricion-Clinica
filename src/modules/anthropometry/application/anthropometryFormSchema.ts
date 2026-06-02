import { z } from "zod";
import { SexSchema } from "@modules/patient/domain/Sex";

const optionalCm = z
  .union([z.literal(""), z.coerce.number({ invalid_type_error: "Debe ser número" }).positive("Debe ser positivo").max(300, "Valor demasiado alto")])
  .optional();

const optionalMm = z
  .union([z.literal(""), z.coerce.number().nonnegative().max(80, "Valor demasiado alto")])
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
  ageYears: z.coerce.number().int().min(0).max(130),
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
  notes: z.string().max(2000).optional().or(z.literal("")),
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

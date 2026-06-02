import { z } from "zod";
import { SexSchema, type Sex } from "@modules/patient/domain/Sex";
import { EmailSchema, PhoneSchema } from "@modules/patient/domain/Contact";

export const PatientFormSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, "Mínimo 2 caracteres")
      .max(100, "Máximo 100 caracteres"),
    lastName: z
      .string()
      .trim()
      .min(2, "Mínimo 2 caracteres")
      .max(100, "Máximo 100 caracteres"),
    birthDate: z
      .string()
      .min(1, "Requerido")
      .refine((v) => !Number.isNaN(new Date(v).getTime()), "Fecha inválida")
      .refine((v) => new Date(v).getTime() <= Date.now(), "No puede estar en el futuro")
      .refine((v) => new Date(v).getTime() >= new Date(1900, 0, 1).getTime(), "No anterior a 1900"),
    sex: SexSchema,
    email: z
      .string()
      .trim()
      .max(254)
      .transform((v) => v || "")
      .pipe(z.union([z.literal(""), EmailSchema])),
    phone: z
      .string()
      .trim()
      .max(20)
      .transform((v) => v || "")
      .pipe(z.union([z.literal(""), PhoneSchema])),
    notes: z.string().max(2000, "Máximo 2000 caracteres").optional().or(z.literal("")),
  })
  .strict();

export type PatientFormValues = z.infer<typeof PatientFormSchema>;

export const patientFormDefaultValues: PatientFormValues = {
  firstName: "",
  lastName: "",
  birthDate: "",
  sex: "undisclosed" as Sex,
  email: "",
  phone: "",
  notes: "",
};

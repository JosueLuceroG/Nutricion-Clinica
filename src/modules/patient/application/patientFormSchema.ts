import { z } from "zod";
import { SexSchema, type Sex } from "@modules/patient/domain/Sex";
import { GenderSchema } from "@modules/patient/domain/Gender";
import { MaritalStatusSchema } from "@modules/patient/domain/MaritalStatus";
import { EducationLevelSchema } from "@modules/patient/domain/EducationLevel";
import { EmailSchema, PhoneSchema } from "@modules/patient/domain/Contact";

const optionalPhone = z
  .string()
  .trim()
  .max(20)
  .transform((v) => v || "")
  .pipe(z.union([z.literal(""), PhoneSchema]));

export const BirthDateFormSchema = z
  .string()
  .trim()
  .min(1, "Requerido")
  .refine(
    (value) => parseDateOnlyAtLocalNoon(value) !== null,
    "Ingresa una fecha válida",
  )
  .refine((value) => {
    const date = parseDateOnlyAtLocalNoon(value);
    return date === null || date <= localTodayAtNoon();
  }, "La fecha de nacimiento no puede estar en el futuro")
  .refine((value) => {
    const date = parseDateOnlyAtLocalNoon(value);
    return date === null || date >= new Date(1900, 0, 1, 12);
  }, "La fecha de nacimiento no puede ser anterior a 1900");

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
    secondLastName: z.string().trim().max(100).optional().or(z.literal("")),
    birthDate: BirthDateFormSchema,
    sex: SexSchema,
    gender: GenderSchema.optional(),
    maritalStatus: MaritalStatusSchema.optional(),
    occupation: z.string().trim().max(200).optional().or(z.literal("")),
    education: EducationLevelSchema.optional(),
    email: z
      .string()
      .trim()
      .max(254)
      .transform((v) => v || "")
      .pipe(z.union([z.literal(""), EmailSchema])),
    phone: optionalPhone,
    secondaryPhone: optionalPhone,
    emergencyContactName: z
      .string()
      .trim()
      .max(200)
      .optional()
      .or(z.literal("")),
    emergencyContactRelationship: z
      .string()
      .trim()
      .max(100)
      .optional()
      .or(z.literal("")),
    emergencyContactPhone: optionalPhone,
    generalNotes: z
      .string()
      .max(2000, "Máximo 2000 caracteres")
      .optional()
      .or(z.literal("")),
    clinicalTags: z.string().optional().or(z.literal("")),
    claveInterna: z.string().trim().max(50).optional().or(z.literal("")),
    birthPlace: z.string().trim().max(200).optional().or(z.literal("")),
    address: z.string().trim().max(500).optional().or(z.literal("")),
    nationality: z.string().trim().max(100).optional().or(z.literal("")),
    idType: z.string().trim().max(50).optional().or(z.literal("")),
    idNumber: z.string().trim().max(100).optional().or(z.literal("")),
    dischargeReason: z.string().trim().max(500).optional().or(z.literal("")),
    responsibleProfessionalId: z
      .string()
      .trim()
      .max(50)
      .optional()
      .or(z.literal("")),
    externalRecordNumber: z
      .string()
      .trim()
      .max(100)
      .optional()
      .or(z.literal("")),
    admissionReason: z.string().trim().max(500).optional().or(z.literal("")),
    photoUrl: z.string().trim().max(7_000_000).optional().or(z.literal("")),
  })
  .strict();

export type PatientFormValues = z.infer<typeof PatientFormSchema>;

export const patientFormDefaultValues: PatientFormValues = {
  firstName: "",
  lastName: "",
  secondLastName: "",
  birthDate: "",
  sex: "undisclosed" as Sex,
  gender: undefined,
  maritalStatus: undefined,
  occupation: "",
  education: undefined,
  email: "",
  phone: "",
  secondaryPhone: "",
  emergencyContactName: "",
  emergencyContactRelationship: "",
  emergencyContactPhone: "",
  generalNotes: "",
  clinicalTags: "",
  claveInterna: "",
  birthPlace: "",
  address: "",
  nationality: "",
  idType: "",
  idNumber: "",
  dischargeReason: "",
  responsibleProfessionalId: "",
  externalRecordNumber: "",
  admissionReason: "",
  photoUrl: "",
};

export function parseDateOnlyAtLocalNoon(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

export function parseBirthDateForPersistence(
  value: string,
  now: Date = new Date(),
): Date | null {
  const date = parseDateOnlyAtLocalNoon(value);
  if (!date) return null;

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return isToday && date > now ? new Date(now) : date;
}

function localTodayAtNoon(): Date {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return today;
}

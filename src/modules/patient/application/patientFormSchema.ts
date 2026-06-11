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
    birthDate: z
      .string()
      .min(1, "Requerido")
      .refine((v) => !Number.isNaN(new Date(v).getTime()), "Fecha inválida")
      .refine((v) => new Date(v).getTime() <= Date.now(), "No puede estar en el futuro")
      .refine((v) => new Date(v).getTime() >= new Date(1900, 0, 1).getTime(), "No anterior a 1900"),
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
    emergencyContactName: z.string().trim().max(200).optional().or(z.literal("")),
    emergencyContactRelationship: z.string().trim().max(100).optional().or(z.literal("")),
    emergencyContactPhone: optionalPhone,
    generalNotes: z.string().max(2000, "Máximo 2000 caracteres").optional().or(z.literal("")),
    clinicalTags: z.string().optional().or(z.literal("")),
    claveInterna: z.string().trim().max(50).optional().or(z.literal("")),
    birthPlace: z.string().trim().max(200).optional().or(z.literal("")),
    address: z.string().trim().max(500).optional().or(z.literal("")),
    nationality: z.string().trim().max(100).optional().or(z.literal("")),
    idType: z.string().trim().max(50).optional().or(z.literal("")),
    idNumber: z.string().trim().max(100).optional().or(z.literal("")),
    dischargeReason: z.string().trim().max(500).optional().or(z.literal("")),
    responsibleProfessionalId: z.string().trim().max(50).optional().or(z.literal("")),
    externalRecordNumber: z.string().trim().max(100).optional().or(z.literal("")),
    photoUrl: z.string().trim().max(500).optional().or(z.literal("")),
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
  photoUrl: "",
};

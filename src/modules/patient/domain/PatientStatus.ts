import { z } from "zod";

export const PatientStatusSchema = z.enum(["active", "inactive", "archived", "deceased"]);

export type PatientStatus = z.infer<typeof PatientStatusSchema>;

export const PatientStatusLabel: Record<PatientStatus, string> = {
  active: "Activo",
  inactive: "Inactivo",
  archived: "Archivado",
  deceased: "Fallecido",
};

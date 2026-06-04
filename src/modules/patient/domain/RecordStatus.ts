import { z } from "zod";

export const RecordStatusSchema = z.enum(["active", "inactive", "discharged", "referred"]);

export type RecordStatus = z.infer<typeof RecordStatusSchema>;

export const RecordStatusLabel: Record<RecordStatus, string> = {
  active: "Activo",
  inactive: "Inactivo",
  discharged: "Alta",
  referred: "Derivado",
};

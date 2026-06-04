import { z } from "zod";

export const EducationLevelSchema = z.enum([
  "none", "primary", "secondary", "high_school", "bachelor", "postgraduate",
]);

export type EducationLevel = z.infer<typeof EducationLevelSchema>;

export const EducationLevelLabel: Record<EducationLevel, string> = {
  none: "Ninguno",
  primary: "Primaria",
  secondary: "Secundaria",
  high_school: "Preparatoria / Bachillerato",
  bachelor: "Licenciatura",
  postgraduate: "Posgrado",
};

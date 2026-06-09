import { z } from "zod";
import { DocumentTypeSchema } from "../domain/DocumentTypes";

export const DocumentFormSchema = z.object({
  patientId: z.string().uuid().optional(),
  consultationId: z.string().uuid().optional(),
  type: DocumentTypeSchema,
  title: z.string().min(1, "Título requerido").max(300),
  contentHtml: z.string().default(""),
  parameters: z.string().default("{}"),
});
export type DocumentFormInput = z.infer<typeof DocumentFormSchema>;

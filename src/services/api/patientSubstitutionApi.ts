import { z } from "zod";
import { httpRequest } from "./httpClient.js";
import { recordClinicalAudit } from "@services/audit/clinicalAudit";

const SubstitutionSchema = z.object({
  id: z.number(),
  pacienteId: z.string(),
  originalFoodId: z.string().nullable(),
  substituteFoodId: z.string(),
  mealSlot: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  isActive: z.boolean(),
});

export type PatientSubstitution = z.infer<typeof SubstitutionSchema>;

const SubstitutionInputSchema = z.object({
  originalFoodId: z.string().nullable().optional(),
  substituteFoodId: z.string().min(1),
  mealSlot: z.string().nullable().optional(),
});

export type SubstitutionInput = z.infer<typeof SubstitutionInputSchema>;

export async function getPatientSubstitutions(
  pacienteId: string,
  signal?: AbortSignal,
): Promise<PatientSubstitution[]> {
  const response = await httpRequest<unknown>(`/pacientes/${encodeURIComponent(pacienteId)}/substitutions`, {
    signal,
  });
  return z.object({ substitutions: z.array(SubstitutionSchema) }).parse(response).substitutions;
}

export async function createPatientSubstitution(
  pacienteId: string,
  input: SubstitutionInput,
  signal?: AbortSignal,
): Promise<PatientSubstitution> {
  const response = await httpRequest<unknown>(`/pacientes/${encodeURIComponent(pacienteId)}/substitutions`, {
    method: "POST",
    body: SubstitutionInputSchema.parse(input),
    signal,
  });
  const substitution = SubstitutionSchema.parse(response);
  await recordClinicalAudit({ module: "patient_substitutions", action: "create", resourceType: "patient_substitution", resourceId: String(substitution.id), patientId: pacienteId });
  return substitution;
}

export async function updatePatientSubstitution(
  pacienteId: string,
  subId: number,
  input: Partial<SubstitutionInput>,
  signal?: AbortSignal,
): Promise<void> {
  await httpRequest(`/pacientes/${encodeURIComponent(pacienteId)}/substitutions/${subId}`, {
    method: "PUT",
    body: input,
    signal,
  });
  await recordClinicalAudit({ module: "patient_substitutions", action: "update", resourceType: "patient_substitution", resourceId: String(subId), patientId: pacienteId });
}

export async function deletePatientSubstitution(
  pacienteId: string,
  subId: number,
  signal?: AbortSignal,
): Promise<void> {
  await httpRequest(`/pacientes/${encodeURIComponent(pacienteId)}/substitutions/${subId}`, {
    method: "DELETE",
    signal,
  });
  await recordClinicalAudit({ module: "patient_substitutions", action: "remove", resourceType: "patient_substitution", resourceId: String(subId), patientId: pacienteId });
}

export async function batchSavePatientSubstitutions(
  pacienteId: string,
  substitutions: SubstitutionInput[],
  signal?: AbortSignal,
): Promise<{ inserted: number }> {
  const response = await httpRequest<unknown>(`/pacientes/${encodeURIComponent(pacienteId)}/substitutions/batch`, {
    method: "POST",
    body: { substitutions },
    signal,
  });
  const result = z.object({ inserted: z.number() }).parse(response);
  await recordClinicalAudit({ module: "patient_substitutions", action: "create", resourceType: "patient_substitution", resourceId: pacienteId, patientId: pacienteId, justification: `batch:${result.inserted}` });
  return result;
}

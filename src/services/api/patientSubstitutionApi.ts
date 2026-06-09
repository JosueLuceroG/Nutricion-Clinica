import { z } from "zod";
import { httpRequest } from "./httpClient.js";

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
    body: JSON.stringify(SubstitutionInputSchema.parse(input)),
    signal,
  });
  return SubstitutionSchema.parse(response);
}

export async function updatePatientSubstitution(
  pacienteId: string,
  subId: number,
  input: Partial<SubstitutionInput>,
  signal?: AbortSignal,
): Promise<void> {
  await httpRequest(`/pacientes/${encodeURIComponent(pacienteId)}/substitutions/${subId}`, {
    method: "PUT",
    body: JSON.stringify(input),
    signal,
  });
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
}

export async function batchSavePatientSubstitutions(
  pacienteId: string,
  substitutions: SubstitutionInput[],
  signal?: AbortSignal,
): Promise<{ inserted: number }> {
  const response = await httpRequest<unknown>(`/pacientes/${encodeURIComponent(pacienteId)}/substitutions/batch`, {
    method: "POST",
    body: JSON.stringify({ substitutions }),
    signal,
  });
  return z.object({ inserted: z.number() }).parse(response);
}

import { NutrientInteraction } from "../domain/NutrientInteraction";
import { createMedicationCatalogId, type MedicationCatalogId } from "../domain/MedicationCatalogId";
import type { MedicationRepository } from "../domain/MedicationRepository";
import type { NutrientInteractionFormInput } from "./medicationFormSchema";

export const createInteractionUC = async (
  repo: MedicationRepository,
  input: NutrientInteractionFormInput,
): Promise<NutrientInteraction> => {
  const interaction = NutrientInteraction.create({
    id: createMedicationCatalogId(),
    medicamento_id: input.medicamento_id as MedicationCatalogId,
    nutriente: input.nutriente,
    tipo: input.tipo,
    severidad: input.severidad,
    recomendacion: input.recomendacion,
    fuente: input.fuente ?? "",
    fecha_vigencia: input.fecha_vigencia ?? null,
  });
  await repo.saveInteraction(interaction);
  return interaction;
};

export const updateInteractionUC = async (
  repo: MedicationRepository,
  id: MedicationCatalogId,
  input: Partial<NutrientInteractionFormInput>,
): Promise<NutrientInteraction> => {
  const existing = await repo.findInteractionById(id);
  if (!existing) throw new Error(`Interacción no encontrada: ${id}`);
  const updated = existing.with({
    nutriente: input.nutriente ?? existing.nutriente,
    tipo: input.tipo ?? existing.tipo,
    severidad: input.severidad ?? existing.severidad,
    recomendacion: input.recomendacion ?? existing.recomendacion,
    fuente: input.fuente ?? existing.fuente,
    fecha_vigencia: input.fecha_vigencia !== undefined ? input.fecha_vigencia : existing.fecha_vigencia,
  });
  await repo.saveInteraction(updated);
  return updated;
};

export const deleteInteractionUC = async (
  repo: MedicationRepository,
  id: MedicationCatalogId,
): Promise<void> => {
  await repo.deleteInteraction(id);
};

export const listInteractionsByMedicationUC = async (
  repo: MedicationRepository,
  medicationId: MedicationCatalogId,
): Promise<NutrientInteraction[]> => {
  return repo.findInteractionsByMedication(medicationId);
};

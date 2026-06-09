import { db } from "@services/db/dexieSchema";
import { DexieMedicationRepository } from "@modules/medication/infrastructure/DexieMedicationRepository";
import { createMedicationUC, updateMedicationUC, deleteMedicationUC, listMedicationsUC, getMedicationByIdUC, searchMedicationsUC } from "@modules/medication/application/medicationCatalogUseCases";
import { createInteractionUC, updateInteractionUC, deleteInteractionUC, listInteractionsByMedicationUC } from "@modules/medication/application/nutrientInteractionUseCases";
import type { MedicationCatalogId } from "@modules/medication/domain/MedicationCatalogId";
import type { MedicationCatalog } from "@modules/medication/domain/MedicationCatalog";
import type { NutrientInteraction } from "@modules/medication/domain/NutrientInteraction";
import type { MedicationCatalogFormInput, NutrientInteractionFormInput } from "@modules/medication/application/medicationFormSchema";

const repository = new DexieMedicationRepository(db);

export const medicationService = {
  create: (input: MedicationCatalogFormInput): Promise<MedicationCatalog> => createMedicationUC(repository, input),
  update: (id: MedicationCatalogId, input: Partial<MedicationCatalogFormInput>): Promise<MedicationCatalog> => updateMedicationUC(repository, id, input),
  delete: (id: MedicationCatalogId): Promise<void> => deleteMedicationUC(repository, id),
  list: (): Promise<MedicationCatalog[]> => listMedicationsUC(repository),
  getById: (id: MedicationCatalogId): Promise<MedicationCatalog | null> => getMedicationByIdUC(repository, id),
  search: (query: string): Promise<MedicationCatalog[]> => searchMedicationsUC(repository, query),
  createInteraction: (input: NutrientInteractionFormInput): Promise<NutrientInteraction> => createInteractionUC(repository, input),
  updateInteraction: (id: MedicationCatalogId, input: Partial<NutrientInteractionFormInput>): Promise<NutrientInteraction> => updateInteractionUC(repository, id, input),
  deleteInteraction: (id: MedicationCatalogId): Promise<void> => deleteInteractionUC(repository, id),
  listInteractionsByMedication: (medicationId: MedicationCatalogId): Promise<NutrientInteraction[]> => listInteractionsByMedicationUC(repository, medicationId),
};

export type MedicationService = typeof medicationService;

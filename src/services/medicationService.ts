import { db } from "@services/db/dexieSchema";
import { DexieMedicationRepository } from "@modules/medication/infrastructure/DexieMedicationRepository";
import { createMedicationUC, updateMedicationUC, deleteMedicationUC, listMedicationsUC, getMedicationByIdUC, searchMedicationsUC } from "@modules/medication/application/medicationCatalogUseCases";
import { createInteractionUC, updateInteractionUC, deleteInteractionUC, listInteractionsByMedicationUC } from "@modules/medication/application/nutrientInteractionUseCases";
import type { MedicationCatalogId } from "@modules/medication/domain/MedicationCatalogId";
import type { MedicationCatalog } from "@modules/medication/domain/MedicationCatalog";
import type { NutrientInteraction } from "@modules/medication/domain/NutrientInteraction";
import type { MedicationCatalogFormInput, NutrientInteractionFormInput } from "@modules/medication/application/medicationFormSchema";
import { recordClinicalAudit } from "@services/audit/clinicalAudit";

const repository = new DexieMedicationRepository(db);

export const medicationService = {
  create: async (input: MedicationCatalogFormInput): Promise<MedicationCatalog> => {
    const medication = await createMedicationUC(repository, input);
    await recordClinicalAudit({ module: "medication_catalog", action: "create", resourceType: "medication_catalog", resourceId: medication.id });
    return medication;
  },
  update: async (id: MedicationCatalogId, input: Partial<MedicationCatalogFormInput>): Promise<MedicationCatalog> => {
    const medication = await updateMedicationUC(repository, id, input);
    await recordClinicalAudit({ module: "medication_catalog", action: "update", resourceType: "medication_catalog", resourceId: medication.id });
    return medication;
  },
  delete: async (id: MedicationCatalogId): Promise<void> => {
    await deleteMedicationUC(repository, id);
    await recordClinicalAudit({ module: "medication_catalog", action: "remove", resourceType: "medication_catalog", resourceId: id });
  },
  list: (): Promise<MedicationCatalog[]> => listMedicationsUC(repository),
  getById: (id: MedicationCatalogId): Promise<MedicationCatalog | null> => getMedicationByIdUC(repository, id),
  search: (query: string): Promise<MedicationCatalog[]> => searchMedicationsUC(repository, query),
  createInteraction: async (input: NutrientInteractionFormInput): Promise<NutrientInteraction> => {
    const interaction = await createInteractionUC(repository, input);
    await recordClinicalAudit({ module: "medication_catalog", action: "create", resourceType: "nutrient_interaction", resourceId: interaction.id, justification: `medication:${interaction.medicamento_id}` });
    return interaction;
  },
  updateInteraction: async (id: MedicationCatalogId, input: Partial<NutrientInteractionFormInput>): Promise<NutrientInteraction> => {
    const interaction = await updateInteractionUC(repository, id, input);
    await recordClinicalAudit({ module: "medication_catalog", action: "update", resourceType: "nutrient_interaction", resourceId: interaction.id, justification: `medication:${interaction.medicamento_id}` });
    return interaction;
  },
  deleteInteraction: async (id: MedicationCatalogId): Promise<void> => {
    await deleteInteractionUC(repository, id);
    await recordClinicalAudit({ module: "medication_catalog", action: "remove", resourceType: "nutrient_interaction", resourceId: id });
  },
  listInteractionsByMedication: (medicationId: MedicationCatalogId): Promise<NutrientInteraction[]> => listInteractionsByMedicationUC(repository, medicationId),
};

export type MedicationService = typeof medicationService;

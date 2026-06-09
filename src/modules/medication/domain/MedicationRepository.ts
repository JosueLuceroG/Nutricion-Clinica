import type { MedicationCatalog } from "./MedicationCatalog";
import type { NutrientInteraction } from "./NutrientInteraction";
import type { MedicationCatalogId } from "./MedicationCatalogId";

export interface MedicationRepository {
  saveCatalog(medication: MedicationCatalog): Promise<void>;
  findCatalogById(id: MedicationCatalogId): Promise<MedicationCatalog | null>;
  findAllCatalog(): Promise<MedicationCatalog[]>;
  searchCatalog(query: string): Promise<MedicationCatalog[]>;
  deleteCatalog(id: MedicationCatalogId): Promise<void>;

  saveInteraction(interaction: NutrientInteraction): Promise<void>;
  findInteractionById(id: MedicationCatalogId): Promise<NutrientInteraction | null>;
  findInteractionsByMedication(medicationId: MedicationCatalogId): Promise<NutrientInteraction[]>;
  findAllInteractions(): Promise<NutrientInteraction[]>;
  deleteInteraction(id: MedicationCatalogId): Promise<void>;
}

export class MedicationCatalogNotFoundError extends Error {
  constructor(public readonly id: MedicationCatalogId) {
    super(`Medicamento no encontrado: ${id}`);
    this.name = "MedicationCatalogNotFoundError";
  }
}

export class NutrientInteractionNotFoundError extends Error {
  constructor(public readonly id: MedicationCatalogId) {
    super(`Interacción no encontrada: ${id}`);
    this.name = "NutrientInteractionNotFoundError";
  }
}

export type { MedicationCatalog, NutrientInteraction, MedicationCatalogId };

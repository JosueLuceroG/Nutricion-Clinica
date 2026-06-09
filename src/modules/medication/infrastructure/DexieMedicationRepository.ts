import type { MedicationRepository } from "../domain/MedicationRepository";
import { MedicationCatalogNotFoundError, NutrientInteractionNotFoundError } from "../domain/MedicationRepository";
import type { MedicationCatalog } from "../domain/MedicationCatalog";
import type { NutrientInteraction } from "../domain/NutrientInteraction";
import type { MedicationCatalogId } from "../domain/MedicationCatalogId";
import { medicationCatalogDomainToRow, medicationCatalogRowToDomain, nutrientInteractionDomainToRow, nutrientInteractionRowToDomain } from "./medicationMapper";
import type { NutriClinicaDB } from "@services/db/dexieSchema";

export class DexieMedicationRepository implements MedicationRepository {
  constructor(private readonly db: NutriClinicaDB) {}

  async saveCatalog(medication: MedicationCatalog): Promise<void> {
    const row = medicationCatalogDomainToRow(medication);
    await this.db.medication_catalog.put(row);
  }

  async findCatalogById(id: MedicationCatalogId): Promise<MedicationCatalog | null> {
    const row = await this.db.medication_catalog.get(id);
    if (!row) return null;
    return medicationCatalogRowToDomain(row);
  }

  async findAllCatalog(): Promise<MedicationCatalog[]> {
    const rows = await this.db.medication_catalog.orderBy("created_at").reverse().toArray();
    return rows.map(medicationCatalogRowToDomain);
  }

  async searchCatalog(query: string): Promise<MedicationCatalog[]> {
    const q = query.toLowerCase();
    const all = await this.findAllCatalog();
    return all.filter(
      (m) =>
        m.nombre_comercial.toLowerCase().includes(q) ||
        m.principio_activo.toLowerCase().includes(q) ||
        m.categoria_farmacologica.toLowerCase().includes(q),
    );
  }

  async deleteCatalog(id: MedicationCatalogId): Promise<void> {
    const existing = await this.db.medication_catalog.get(id);
    if (!existing) throw new MedicationCatalogNotFoundError(id);
    await this.db.medication_catalog.delete(id);
  }

  async saveInteraction(interaction: NutrientInteraction): Promise<void> {
    const row = nutrientInteractionDomainToRow(interaction);
    await this.db.nutrient_interactions.put(row);
  }

  async findInteractionById(id: MedicationCatalogId): Promise<NutrientInteraction | null> {
    const row = await this.db.nutrient_interactions.get(id);
    if (!row) return null;
    return nutrientInteractionRowToDomain(row);
  }

  async findInteractionsByMedication(medicationId: MedicationCatalogId): Promise<NutrientInteraction[]> {
    const rows = await this.db.nutrient_interactions.where("medicamento_id").equals(medicationId).toArray();
    return rows.map(nutrientInteractionRowToDomain);
  }

  async findAllInteractions(): Promise<NutrientInteraction[]> {
    const rows = await this.db.nutrient_interactions.orderBy("created_at").reverse().toArray();
    return rows.map(nutrientInteractionRowToDomain);
  }

  async deleteInteraction(id: MedicationCatalogId): Promise<void> {
    const existing = await this.db.nutrient_interactions.get(id);
    if (!existing) throw new NutrientInteractionNotFoundError(id);
    await this.db.nutrient_interactions.delete(id);
  }
}

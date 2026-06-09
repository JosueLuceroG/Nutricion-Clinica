import { MedicationCatalog } from "../domain/MedicationCatalog";
import { createMedicationCatalogId, type MedicationCatalogId } from "../domain/MedicationCatalogId";
import type { MedicationRepository } from "../domain/MedicationRepository";
import type { MedicationCatalogFormInput } from "./medicationFormSchema";
import { parseListInput } from "./medicationFormSchema";

export const createMedicationUC = async (
  repo: MedicationRepository,
  input: MedicationCatalogFormInput,
): Promise<MedicationCatalog> => {
  const medication = MedicationCatalog.create({
    id: createMedicationCatalogId(),
    nombre_comercial: input.nombre_comercial,
    principio_activo: input.principio_activo,
    presentacion: input.presentacion,
    concentracion: input.concentracion,
    via_administracion: input.via_administracion,
    categoria_farmacologica: input.categoria_farmacologica ?? "",
    efectos_secundarios: parseListInput(input.efectos_secundarios),
    contraindicaciones: parseListInput(input.contraindicaciones),
    notas: input.notas ?? "",
  });
  await repo.saveCatalog(medication);
  return medication;
};

export const updateMedicationUC = async (
  repo: MedicationRepository,
  id: MedicationCatalogId,
  input: Partial<MedicationCatalogFormInput>,
): Promise<MedicationCatalog> => {
  const existing = await repo.findCatalogById(id);
  if (!existing) throw new Error(`Medicamento no encontrado: ${id}`);
  const updated = existing.with({
    nombre_comercial: input.nombre_comercial ?? existing.nombre_comercial,
    principio_activo: input.principio_activo ?? existing.principio_activo,
    presentacion: input.presentacion ?? existing.presentacion,
    concentracion: input.concentracion ?? existing.concentracion,
    via_administracion: input.via_administracion ?? existing.via_administracion,
    categoria_farmacologica: input.categoria_farmacologica ?? existing.categoria_farmacologica,
    notas: input.notas ?? existing.notas,
  });
  await repo.saveCatalog(updated);
  return updated;
};

export const deleteMedicationUC = async (
  repo: MedicationRepository,
  id: MedicationCatalogId,
): Promise<void> => {
  await repo.deleteCatalog(id);
};

export const listMedicationsUC = async (repo: MedicationRepository): Promise<MedicationCatalog[]> => {
  return repo.findAllCatalog();
};

export const getMedicationByIdUC = async (
  repo: MedicationRepository,
  id: MedicationCatalogId,
): Promise<MedicationCatalog | null> => {
  return repo.findCatalogById(id);
};

export const searchMedicationsUC = async (
  repo: MedicationRepository,
  query: string,
): Promise<MedicationCatalog[]> => {
  return repo.searchCatalog(query);
};

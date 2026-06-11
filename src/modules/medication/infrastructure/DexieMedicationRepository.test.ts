import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexieMedicationRepository } from "./DexieMedicationRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { MedicationCatalog } from "../domain/MedicationCatalog";
import { NutrientInteraction } from "../domain/NutrientInteraction";
import { createMedicationCatalogId } from "../domain/MedicationCatalogId";
import { MedicationCatalogNotFoundError, NutrientInteractionNotFoundError } from "../domain/MedicationRepository";

const makeMedicationCatalog = (overrides: Partial<{
  nombre_comercial: string;
  principio_activo: string;
  presentacion: string;
  concentracion: string;
  via_administracion: "oral" | "IV" | "IM" | "SC" | "topica" | "inhalada";
  categoria_farmacologica: string;
  efectos_secundarios: string[];
  contraindicaciones: string[];
  notas: string;
}> = {}) => {
  return MedicationCatalog.create({
    id: createMedicationCatalogId(),
    nombre_comercial: overrides.nombre_comercial ?? "Paracetamol",
    principio_activo: overrides.principio_activo ?? "Paracetamol",
    presentacion: overrides.presentacion ?? "Tableta",
    concentracion: overrides.concentracion ?? "500 mg",
    via_administracion: overrides.via_administracion ?? "oral",
    categoria_farmacologica: overrides.categoria_farmacologica ?? "Analgésico",
    efectos_secundarios: overrides.efectos_secundarios ?? ["Náuseas"],
    contraindicaciones: overrides.contraindicaciones ?? ["Hipersensibilidad"],
    notas: overrides.notas ?? "",
  });
};

const makeNutrientInteraction = (overrides: Partial<{
  medicamento_id: string;
  nutriente: string;
  tipo: "reduce_absorcion" | "aumenta_absorcion" | "potencia_efecto" | "antagoniza_efecto" | "toxicidad";
  severidad: "leve" | "moderada" | "severa";
  recomendacion: string;
  fuente: string;
  fecha_vigencia: string | null;
}> = {}) => {
  return NutrientInteraction.create({
    id: createMedicationCatalogId(),
    medicamento_id: overrides.medicamento_id ?? createMedicationCatalogId(),
    nutriente: overrides.nutriente ?? "Vitamina K",
    tipo: overrides.tipo ?? "reduce_absorcion",
    severidad: overrides.severidad ?? "moderada",
    recomendacion: overrides.recomendacion ?? "Administrar con alimentos",
    fuente: overrides.fuente ?? "",
    fecha_vigencia: overrides.fecha_vigencia ?? null,
  });
};

describe("DexieMedicationRepository", () => {
  let repo: DexieMedicationRepository;
  let db: NutriClinicaDB;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.delete();
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieMedicationRepository(db);
  });

  describe("MedicationCatalog", () => {
    it("guarda y recupera un catálogo por id", async () => {
      const m = makeMedicationCatalog();
      await repo.saveCatalog(m);

      const found = await repo.findCatalogById(m.id);
      expect(found).not.toBeNull();
      expect(found?.nombre_comercial).toBe("Paracetamol");
      expect(found?.principio_activo).toBe("Paracetamol");
    });

    it("retorna null cuando el catálogo no existe", async () => {
      const found = await repo.findCatalogById(createMedicationCatalogId());
      expect(found).toBeNull();
    });

    it("findAllCatalog retorna todos ordenados por created_at descendente", async () => {
      const m1 = makeMedicationCatalog({ nombre_comercial: "Amoxicilina" });
      const m2 = makeMedicationCatalog({ nombre_comercial: "Ibuprofeno" });
      await repo.saveCatalog(m1);
      await repo.saveCatalog(m2);

      const all = await repo.findAllCatalog();
      expect(all).toHaveLength(2);
      expect(all.map((m) => m.nombre_comercial)).toContain("Amoxicilina");
      expect(all.map((m) => m.nombre_comercial)).toContain("Ibuprofeno");
    });

    it("searchCatalog filtra por nombre_comercial, principio_activo y categoria_farmacologica", async () => {
      await repo.saveCatalog(makeMedicationCatalog({ nombre_comercial: "Amoxicilina", principio_activo: "Amoxicilina", categoria_farmacologica: "Antibiótico" }));
      await repo.saveCatalog(makeMedicationCatalog({ nombre_comercial: "Paracetamol", principio_activo: "Paracetamol", categoria_farmacologica: "Analgésico" }));
      await repo.saveCatalog(makeMedicationCatalog({ nombre_comercial: "Ibuprofeno", principio_activo: "Ibuprofeno", categoria_farmacologica: "Antiinflamatorio" }));

      const results = await repo.searchCatalog("amoxi");
      expect(results).toHaveLength(1);
      expect(results[0]?.nombre_comercial).toBe("Amoxicilina");
    });

    it("deleteCatalog elimina un catálogo existente", async () => {
      const m = makeMedicationCatalog();
      await repo.saveCatalog(m);
      await repo.deleteCatalog(m.id);

      const found = await repo.findCatalogById(m.id);
      expect(found).toBeNull();
    });

    it("deleteCatalog lanza MedicationCatalogNotFoundError si no existe", async () => {
      const id = createMedicationCatalogId();
      await expect(repo.deleteCatalog(id)).rejects.toThrow(MedicationCatalogNotFoundError);
    });
  });

  describe("NutrientInteraction", () => {
    it("guarda y recupera una interacción por id", async () => {
      const interaction = makeNutrientInteraction();
      await repo.saveInteraction(interaction);

      const found = await repo.findInteractionById(interaction.id);
      expect(found).not.toBeNull();
      expect(found?.nutriente).toBe("Vitamina K");
    });

    it("retorna null cuando la interacción no existe", async () => {
      const found = await repo.findInteractionById(createMedicationCatalogId());
      expect(found).toBeNull();
    });

    it("findInteractionsByMedication filtra por medicamento", async () => {
      const medId = createMedicationCatalogId();
      const i1 = makeNutrientInteraction({ medicamento_id: medId, nutriente: "Vitamina K" });
      const i2 = makeNutrientInteraction({ medicamento_id: medId, nutriente: "Calcio" });
      const i3 = makeNutrientInteraction({ nutriente: "Hierro" });

      await repo.saveInteraction(i1);
      await repo.saveInteraction(i2);
      await repo.saveInteraction(i3);

      const results = await repo.findInteractionsByMedication(medId);
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.nutriente).sort()).toEqual(["Calcio", "Vitamina K"]);
    });

    it("findAllInteractions retorna todas las interacciones", async () => {
      const i1 = makeNutrientInteraction({ nutriente: "Vitamina K" });
      const i2 = makeNutrientInteraction({ nutriente: "Calcio" });
      await repo.saveInteraction(i1);
      await repo.saveInteraction(i2);

      const all = await repo.findAllInteractions();
      expect(all).toHaveLength(2);
      expect(all.map((i) => i.nutriente)).toContain("Vitamina K");
      expect(all.map((i) => i.nutriente)).toContain("Calcio");
    });

    it("deleteInteraction elimina una interacción existente", async () => {
      const interaction = makeNutrientInteraction();
      await repo.saveInteraction(interaction);
      await repo.deleteInteraction(interaction.id);

      const found = await repo.findInteractionById(interaction.id);
      expect(found).toBeNull();
    });

    it("deleteInteraction lanza NutrientInteractionNotFoundError si no existe", async () => {
      const id = createMedicationCatalogId();
      await expect(repo.deleteInteraction(id)).rejects.toThrow(NutrientInteractionNotFoundError);
    });
  });
});

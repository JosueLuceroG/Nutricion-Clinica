import { describe, it, expect, vi } from "vitest";
import {
  createMedicationUC,
  updateMedicationUC,
  deleteMedicationUC,
  listMedicationsUC,
  getMedicationByIdUC,
  searchMedicationsUC,
} from "./medicationCatalogUseCases";
import type { MedicationRepository } from "../domain/MedicationRepository";
import { MedicationCatalog } from "../domain/MedicationCatalog";
import { createMedicationCatalogId } from "../domain/MedicationCatalogId";

function createMockRepo(): MedicationRepository {
  const store = new Map<string, MedicationCatalog>();
  return {
    saveCatalog: vi.fn(async (med: MedicationCatalog) => {
      store.set(med.id, med);
    }),
    findCatalogById: vi.fn(async (id) => store.get(id) ?? null),
    findAllCatalog: vi.fn(async () => Array.from(store.values())),
    searchCatalog: vi.fn(async (query: string) => {
      const q = query.toLowerCase();
      return Array.from(store.values()).filter(
        (m) =>
          m.nombre_comercial.toLowerCase().includes(q) ||
          m.principio_activo.toLowerCase().includes(q),
      );
    }),
    deleteCatalog: vi.fn(async (id) => {
      store.delete(id);
    }),
    saveInteraction: vi.fn(),
    findInteractionById: vi.fn(),
    findInteractionsByMedication: vi.fn(),
    findAllInteractions: vi.fn(),
    deleteInteraction: vi.fn(),
  };
}

describe("createMedicationUC", () => {
  it("creates a medication with correct properties", async () => {
    const repo = createMockRepo();
    const input = {
      nombre_comercial: "Paracetamol",
      principio_activo: "Paracetamol",
      presentacion: "Tabletas",
      concentracion: "500 mg",
      via_administracion: "oral" as const,
      categoria_farmacologica: "Analgésico",
      efectos_secundarios: "dolor de cabeza\nnáuseas",
      contraindicaciones: "insuficiencia hepática",
      notas: "Tomar con alimentos",
    };

    const result = await createMedicationUC(repo, input);

    expect(result.nombre_comercial).toBe("Paracetamol");
    expect(result.principio_activo).toBe("Paracetamol");
    expect(result.presentacion).toBe("Tabletas");
    expect(result.concentracion).toBe("500 mg");
    expect(result.via_administracion).toBe("oral");
    expect(result.categoria_farmacologica).toBe("Analgésico");
    expect(result.notas).toBe("Tomar con alimentos");
    expect(result.createdAt).toBeGreaterThan(0);
    expect(result.updatedAt).toBeGreaterThan(0);
    expect(repo.saveCatalog).toHaveBeenCalledWith(result);
  });

  it("uses parseListInput for efectos_secundarios and contraindicaciones from form input", async () => {
    const repo = createMockRepo();
    const input = {
      nombre_comercial: "Ibuprofeno",
      principio_activo: "Ibuprofeno",
      presentacion: "Tabletas",
      concentracion: "400 mg",
      via_administracion: "oral" as const,
      categoria_farmacologica: "",
      efectos_secundarios: "dolor estomacal\nmareo\nsomnolencia",
      contraindicaciones: "úlcera péptica\ninsuficiencia renal",
      notas: "",
    };

    const result = await createMedicationUC(repo, input);

    expect(result.efectos_secundarios).toEqual(["dolor estomacal", "mareo", "somnolencia"]);
    expect(result.contraindicaciones).toEqual(["úlcera péptica", "insuficiencia renal"]);
  });
});

describe("updateMedicationUC", () => {
  it("updates only the provided fields", async () => {
    const repo = createMockRepo();
    const existing = MedicationCatalog.create({
      id: createMedicationCatalogId(),
      nombre_comercial: "Amoxicilina",
      principio_activo: "Amoxicilina",
      presentacion: "Cápsulas",
      concentracion: "500 mg",
      via_administracion: "oral",
      categoria_farmacologica: "Antibiótico",
      efectos_secundarios: ["diarrea"],
      contraindicaciones: ["alergia a penicilinas"],
      notas: "",
    });
    await repo.saveCatalog(existing);

    const result = await updateMedicationUC(repo, existing.id, {
      concentracion: "1 g",
      notas: "Tomar con agua",
    });

    expect(result.nombre_comercial).toBe("Amoxicilina");
    expect(result.principio_activo).toBe("Amoxicilina");
    expect(result.presentacion).toBe("Cápsulas");
    expect(result.concentracion).toBe("1 g");
    expect(result.via_administracion).toBe("oral");
    expect(result.categoria_farmacologica).toBe("Antibiótico");
    expect(result.efectos_secundarios).toEqual(["diarrea"]);
    expect(result.contraindicaciones).toEqual(["alergia a penicilinas"]);
    expect(result.notas).toBe("Tomar con agua");
    expect(repo.saveCatalog).toHaveBeenCalled();
  });

  it("throws when medication does not exist", async () => {
    const repo = createMockRepo();
    const id = createMedicationCatalogId();

    await expect(updateMedicationUC(repo, id, { nombre_comercial: "X" })).rejects.toThrow("no encontrado");
  });
});

describe("deleteMedicationUC", () => {
  it("calls repo.deleteCatalog with the provided id", async () => {
    const repo = createMockRepo();
    const id = createMedicationCatalogId();

    await deleteMedicationUC(repo, id);

    expect(repo.deleteCatalog).toHaveBeenCalledWith(id);
  });
});

describe("listMedicationsUC", () => {
  it("returns all medications from repo", async () => {
    const repo = createMockRepo();
    const med1 = MedicationCatalog.create({
      id: createMedicationCatalogId(),
      nombre_comercial: "Med A",
      principio_activo: "Principio A",
      presentacion: "Tab",
      concentracion: "100 mg",
      via_administracion: "oral",
      categoria_farmacologica: "",
      efectos_secundarios: [],
      contraindicaciones: [],
      notas: "",
    });
    const med2 = MedicationCatalog.create({
      id: createMedicationCatalogId(),
      nombre_comercial: "Med B",
      principio_activo: "Principio B",
      presentacion: "Cap",
      concentracion: "200 mg",
      via_administracion: "oral",
      categoria_farmacologica: "",
      efectos_secundarios: [],
      contraindicaciones: [],
      notas: "",
    });
    await repo.saveCatalog(med1);
    await repo.saveCatalog(med2);

    const result = await listMedicationsUC(repo);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual(med1);
    expect(result).toContainEqual(med2);
  });
});

describe("getMedicationByIdUC", () => {
  it("returns null for non-existent medication", async () => {
    const repo = createMockRepo();

    const result = await getMedicationByIdUC(repo, createMedicationCatalogId());

    expect(result).toBeNull();
  });

  it("returns the medication when found", async () => {
    const repo = createMockRepo();
    const med = MedicationCatalog.create({
      id: createMedicationCatalogId(),
      nombre_comercial: "Med C",
      principio_activo: "Principio C",
      presentacion: "Tab",
      concentracion: "50 mg",
      via_administracion: "oral",
      categoria_farmacologica: "",
      efectos_secundarios: [],
      contraindicaciones: [],
      notas: "",
    });
    await repo.saveCatalog(med);

    const result = await getMedicationByIdUC(repo, med.id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(med.id);
    expect(result!.nombre_comercial).toBe("Med C");
  });
});

describe("searchMedicationsUC", () => {
  it("delegates to repo.searchCatalog with the query", async () => {
    const repo = createMockRepo();

    await searchMedicationsUC(repo, "paracetamol");

    expect(repo.searchCatalog).toHaveBeenCalledWith("paracetamol");
  });
});

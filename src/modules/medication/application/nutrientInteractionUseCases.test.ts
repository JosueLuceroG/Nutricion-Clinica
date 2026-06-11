import { describe, it, expect, vi } from "vitest";
import {
  createInteractionUC,
  updateInteractionUC,
  deleteInteractionUC,
  listInteractionsByMedicationUC,
} from "./nutrientInteractionUseCases";
import type { MedicationRepository } from "../domain/MedicationRepository";
import { NutrientInteraction } from "../domain/NutrientInteraction";
import { createMedicationCatalogId, medicationCatalogIdFrom } from "../domain/MedicationCatalogId";

const validUUID = "550e8400-e29b-41d4-a716-446655440000";
const validUUID2 = "660e8400-e29b-41d4-a716-446655440001";

function createMockRepo(): MedicationRepository {
  const store = new Map<string, NutrientInteraction>();
  return {
    saveCatalog: vi.fn(),
    findCatalogById: vi.fn(),
    findAllCatalog: vi.fn(),
    searchCatalog: vi.fn(),
    deleteCatalog: vi.fn(),
    saveInteraction: vi.fn(async (int: NutrientInteraction) => {
      store.set(int.id, int);
    }),
    findInteractionById: vi.fn(async (id) => store.get(id) ?? null),
    findInteractionsByMedication: vi.fn(async (medId) =>
      Array.from(store.values()).filter((i) => i.medicamento_id === medId),
    ),
    findAllInteractions: vi.fn(async () => Array.from(store.values())),
    deleteInteraction: vi.fn(async (id) => {
      store.delete(id);
    }),
  };
}

describe("createInteractionUC", () => {
  it("crea una interacción y la guarda en el repositorio", async () => {
    const repo = createMockRepo();
    const input = {
      medicamento_id: medicationCatalogIdFrom(validUUID),
      nutriente: "Vitamina K",
      tipo: "antagoniza_efecto" as const,
      severidad: "moderada" as const,
      recomendacion: "Evitar vegetales verdes",
      fuente: "NIH",
      fecha_vigencia: null,
    };

    const result = await createInteractionUC(repo, input);

    expect(result.nutriente).toBe("Vitamina K");
    expect(result.tipo).toBe("antagoniza_efecto");
    expect(result.severidad).toBe("moderada");
    expect(result.recomendacion).toBe("Evitar vegetales verdes");
    expect(result.fuente).toBe("NIH");
    expect(result.fecha_vigencia).toBeNull();
    expect(result.createdAt).toBeGreaterThan(0);
    expect(result.updatedAt).toBeGreaterThan(0);
    expect(repo.saveInteraction).toHaveBeenCalledWith(result);
  });

  it("asigna fuente vacía si no se provee", async () => {
    const repo = createMockRepo();
    const input = {
      medicamento_id: medicationCatalogIdFrom(validUUID),
      nutriente: "Calcio",
      tipo: "reduce_absorcion" as const,
      severidad: "leve" as const,
      recomendacion: "Separar 2 horas",
      fuente: undefined as unknown as string,
      fecha_vigencia: null,
    };

    const result = await createInteractionUC(repo, input);

    expect(result.fuente).toBe("");
  });

  it("asigna fecha_vigencia null si no se provee", async () => {
    const repo = createMockRepo();
    const input = {
      medicamento_id: medicationCatalogIdFrom(validUUID),
      nutriente: "Hierro",
      tipo: "reduce_absorcion" as const,
      severidad: "severa" as const,
      recomendacion: "No administrar juntos",
      fuente: "",
      fecha_vigencia: undefined as unknown as null,
    };

    const result = await createInteractionUC(repo, input);

    expect(result.fecha_vigencia).toBeNull();
  });
});

describe("updateInteractionUC", () => {
  it("actualiza solo los campos proporcionados", async () => {
    const repo = createMockRepo();
    const id = createMedicationCatalogId();
    const existing = NutrientInteraction.create({
      id,
      medicamento_id: medicationCatalogIdFrom(validUUID2),
      nutriente: "Vitamina D",
      tipo: "potencia_efecto",
      severidad: "leve",
      recomendacion: "Monitorear niveles",
      fuente: "Guía clínica",
      fecha_vigencia: null,
    });
    await repo.saveInteraction(existing);

    const result = await updateInteractionUC(repo, id, {
      severidad: "moderada",
      recomendacion: "Ajustar dosis",
    });

    expect(result.nutriente).toBe("Vitamina D");
    expect(result.tipo).toBe("potencia_efecto");
    expect(result.severidad).toBe("moderada");
    expect(result.recomendacion).toBe("Ajustar dosis");
    expect(result.fuente).toBe("Guía clínica");
    expect(repo.saveInteraction).toHaveBeenCalled();
  });

  it("lanza error si la interacción no existe", async () => {
    const repo = createMockRepo();
    const id = createMedicationCatalogId();

    await expect(
      updateInteractionUC(repo, id, { nutriente: "Zinc" }),
    ).rejects.toThrow("no encontrada");
  });

  it("actualiza fecha_vigencia cuando se provee explícitamente", async () => {
    const repo = createMockRepo();
    const id = createMedicationCatalogId();
    const existing = NutrientInteraction.create({
      id,
      medicamento_id: medicationCatalogIdFrom(validUUID2),
      nutriente: "Magnesio",
      tipo: "reduce_absorcion",
      severidad: "leve",
      recomendacion: "Separar tomas",
      fuente: "",
      fecha_vigencia: null,
    });
    await repo.saveInteraction(existing);

    const result = await updateInteractionUC(repo, id, {
      fecha_vigencia: "2026-12-31",
    });

    expect(result.fecha_vigencia).toBe("2026-12-31");
  });
});

describe("deleteInteractionUC", () => {
  it("llama a repo.deleteInteraction con el id proporcionado", async () => {
    const repo = createMockRepo();
    const id = createMedicationCatalogId();

    await deleteInteractionUC(repo, id);

    expect(repo.deleteInteraction).toHaveBeenCalledWith(id);
  });
});

describe("listInteractionsByMedicationUC", () => {
  it("retorna interacciones filtradas por medicamento", async () => {
    const repo = createMockRepo();
    const medId = medicationCatalogIdFrom(validUUID);
    const int1 = NutrientInteraction.create({
      id: createMedicationCatalogId(),
      medicamento_id: medId,
      nutriente: "Vitamina K",
      tipo: "antagoniza_efecto",
      severidad: "moderada",
      recomendacion: "Evitar",
      fuente: "",
      fecha_vigencia: null,
    });
    const int2 = NutrientInteraction.create({
      id: createMedicationCatalogId(),
      medicamento_id: medId,
      nutriente: "Calcio",
      tipo: "reduce_absorcion",
      severidad: "leve",
      recomendacion: "Separar",
      fuente: "",
      fecha_vigencia: null,
    });
    const otroMedId = createMedicationCatalogId();
    const int3 = NutrientInteraction.create({
      id: createMedicationCatalogId(),
      medicamento_id: otroMedId,
      nutriente: "Hierro",
      tipo: "toxicidad",
      severidad: "severa",
      recomendacion: "No combinar",
      fuente: "",
      fecha_vigencia: null,
    });
    await repo.saveInteraction(int1);
    await repo.saveInteraction(int2);
    await repo.saveInteraction(int3);

    const result = await listInteractionsByMedicationUC(repo, medId);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual(int1);
    expect(result).toContainEqual(int2);
    expect(result).not.toContainEqual(int3);
  });

  it("retorna arreglo vacío si no hay interacciones", async () => {
    const repo = createMockRepo();
    const medId = medicationCatalogIdFrom(validUUID);

    const result = await listInteractionsByMedicationUC(repo, medId);

    expect(result).toEqual([]);
  });
});

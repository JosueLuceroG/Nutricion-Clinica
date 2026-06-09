import { describe, it, expect } from "vitest";
import { evaluateAlerts } from "./medicationAlertEngine";
import { MedicationCatalog } from "../domain/MedicationCatalog";
import { NutrientInteraction } from "../domain/NutrientInteraction";
import { createMedicationCatalogId } from "../domain/MedicationCatalogId";

function makeMed(overrides?: Partial<Parameters<typeof MedicationCatalog.create>[0]>) {
  return MedicationCatalog.create({
    id: createMedicationCatalogId(),
    nombre_comercial: "Default",
    principio_activo: "Default",
    presentacion: "Tabletas",
    concentracion: "500 mg",
    via_administracion: "oral",
    categoria_farmacologica: "",
    efectos_secundarios: [],
    contraindicaciones: [],
    notas: "",
    ...overrides,
  });
}

function makeInteraction(
  medicamento_id: string,
  overrides?: Partial<{
    nutriente: string;
    tipo: "reduce_absorcion" | "aumenta_absorcion" | "potencia_efecto" | "antagoniza_efecto" | "toxicidad";
    severidad: "leve" | "moderada" | "severa";
    recomendacion: string;
  }>,
) {
  return NutrientInteraction.create({
    id: createMedicationCatalogId(),
    medicamento_id: medicamento_id as Parameters<typeof NutrientInteraction.create>[0]["medicamento_id"],
    nutriente: "Vitamina D",
    tipo: "reduce_absorcion" as const,
    severidad: "leve" as const,
    recomendacion: "Tomar con alimentos.",
    fuente: "",
    fecha_vigencia: null,
    ...overrides,
  } as Parameters<typeof NutrientInteraction.create>[0]);
}

describe("evaluateAlerts", () => {
  it("returns alerts for hardcoded rules that match medication principio_activo", () => {
    const med = makeMed({ nombre_comercial: "Coumadin", principio_activo: "Warfarina" });

    const alerts = evaluateAlerts([med], []);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].nutriente).toBe("vitamina K");
    expect(alerts[0].tipo).toBe("antagoniza_efecto");
    expect(alerts[0].severidad).toBe("severa");
    expect(alerts[0].principio_activo).toBe("Warfarina");
    expect(alerts[0].medicamento_nombre).toBe("Coumadin");
  });

  it("returns alerts from interactions passed in (not just hardcoded rules)", () => {
    const med = makeMed({ nombre_comercial: "Vitamina D", principio_activo: "Colecalciferol" });
    const interaction = makeInteraction(med.id, { nutriente: "Calcio" });

    const alerts = evaluateAlerts([med], [interaction]);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].nutriente).toBe("Calcio");
    expect(alerts[0].medicamento_id).toBe(med.id);
  });

  it("returns empty array for medications with no matching rules/interactions", () => {
    const med = makeMed({ nombre_comercial: "Random", principio_activo: "PrincipioRandom" });

    const alerts = evaluateAlerts([med], []);

    expect(alerts).toHaveLength(0);
  });

  it("matches by normalized, accent-insensitive text", () => {
    const med = makeMed({ nombre_comercial: "Metformina", principio_activo: "Metformína" });

    const alerts = evaluateAlerts([med], []);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].nutriente).toBe("vitamina B12");
  });

  it("handles both hardcoded rules AND interactions concurrently", () => {
    const med = makeMed({ nombre_comercial: "Coumadin", principio_activo: "Warfarina" });
    const interaction = makeInteraction(med.id, {
      nutriente: "Vitamina E",
      tipo: "potencia_efecto",
      severidad: "moderada",
      recomendacion: "Monitorear niveles.",
    });

    const alerts = evaluateAlerts([med], [interaction]);

    expect(alerts).toHaveLength(2);
    const hardcodedAlert = alerts.find((a) => a.nutriente === "vitamina K");
    const interactionAlert = alerts.find((a) => a.nutriente === "Vitamina E");
    expect(hardcodedAlert).toBeDefined();
    expect(hardcodedAlert?.tipo).toBe("antagoniza_efecto");
    expect(hardcodedAlert?.severidad).toBe("severa");
    expect(interactionAlert).toBeDefined();
    expect(interactionAlert?.tipo).toBe("potencia_efecto");
    expect(interactionAlert?.severidad).toBe("moderada");
    expect(interactionAlert?.recomendacion).toBe("Monitorear niveles.");
  });

  it("correctly assigns severity, tipo, and recomendacion from the matched rule", () => {
    const med = makeMed({ nombre_comercial: "Tetraciclina", principio_activo: "Tetraciclina" });

    const alerts = evaluateAlerts([med], []);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].tipo).toBe("reduce_absorcion");
    expect(alerts[0].severidad).toBe("moderada");
    expect(alerts[0].recomendacion).toBe("Separar 2h de lácteos y suplementos de calcio/hierro.");
    expect(alerts[0].nutriente).toBe("calcio / hierro");
  });
});

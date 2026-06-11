import { describe, it, expect } from "vitest";
import { LabPanel } from "./LabPanel";
import { LabPanelId } from "./LabPanelId";
import { LabPanelNotFoundError } from "./LabPanelRepository";
import {
  LabResult,
  classifyLabValue,
  LabFlagLabel,
  LabFlagColor,
} from "./LabResult";
import {
  LabTestCodeSchema,
  LabTestCategorySchema,
  LabTestCategoryLabel,
  LAB_TEST_CODES,
  LAB_TEST_DEFINITIONS,
  getLabTestDefinition,
  getLabTestsByCategory,
} from "./LabTest";
import {
  findReferenceRange,
  LabValue,
} from "./LabReferenceRange";
import { PatientId } from "@modules/patient/domain/PatientId";

// ---------------------------------------------------------------------------
// LabPanel
// ---------------------------------------------------------------------------
describe("LabPanel", () => {
  const pid = PatientId.generate();

  const validInput = () => ({
    patientId: pid,
    takenAt: new Date(),
    results: [LabResult.from({ test: "GLUCOSA", value: 90 })],
  });

  it("create construye panel válido con valores por defecto", () => {
    const panel = LabPanel.create(validInput());
    expect(panel.patientId.equals(pid)).toBe(true);
    expect(panel.results).toHaveLength(1);
    expect(panel.id).toBeInstanceOf(LabPanelId);
    expect(panel.labName).toBeNull();
    expect(panel.notes).toBeNull();
    expect(panel.deletedAt).toBeNull();
    expect(panel.createdAt).toBeInstanceOf(Date);
    expect(panel.updatedAt).toBeInstanceOf(Date);
  });

  it("create asigna id generado si no se provee", () => {
    const panel = LabPanel.create(validInput());
    expect(panel.id.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("create acepta id explícito", () => {
    const id = LabPanelId.generate();
    const panel = LabPanel.create({ ...validInput(), id });
    expect(panel.id.equals(id)).toBe(true);
  });

  it("create acepta labName y notes", () => {
    const panel = LabPanel.create({
      ...validInput(),
      labName: "Lab Clínico",
      notes: "En ayuno",
    });
    expect(panel.labName).toBe("Lab Clínico");
    expect(panel.notes).toBe("En ayuno");
  });

  it("create rechaza fecha en el futuro lejano", () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    expect(() =>
      LabPanel.create({ ...validInput(), takenAt: future }),
    ).toThrow(/futuro/);
  });

  it("create rechaza fecha anterior a 1900", () => {
    expect(() =>
      LabPanel.create({ ...validInput(), takenAt: new Date("1899-01-01") }),
    ).toThrow(/1900/);
  });

  it("create rechaza fecha inválida (NaN)", () => {
    expect(() =>
      LabPanel.create({ ...validInput(), takenAt: new Date("invalid") }),
    ).toThrow(/inválida/);
  });

  it("create rechaza panel sin resultados", () => {
    expect(() =>
      LabPanel.create({ ...validInput(), results: [] }),
    ).toThrow(/al menos un resultado/);
  });

  it("reconstitute preserva todas las propiedades", () => {
    const original = LabPanel.create(validInput());
    const reconstituted = LabPanel.reconstitute(original.toProps());
    expect(reconstituted.id.equals(original.id)).toBe(true);
    expect(reconstituted.patientId.equals(original.patientId)).toBe(true);
    expect(reconstituted.takenAt.getTime()).toBe(original.takenAt.getTime());
    expect(reconstituted.labName).toBe(original.labName);
    expect(reconstituted.results).toHaveLength(original.results.length);
    expect(reconstituted.notes).toBe(original.notes);
    expect(reconstituted.createdAt.getTime()).toBe(original.createdAt.getTime());
    expect(reconstituted.updatedAt.getTime()).toBe(original.updatedAt.getTime());
    expect(reconstituted.deletedAt).toBeNull();
  });

  it("softDelete marca deletedAt", () => {
    const panel = LabPanel.create(validInput());
    const deleted = panel.softDelete();
    expect(deleted.deletedAt).not.toBeNull();
    expect(panel.deletedAt).toBeNull();
  });

  it("softDelete es idempotente", () => {
    const panel = LabPanel.create(validInput());
    const d1 = panel.softDelete();
    const d2 = d1.softDelete();
    expect(d2.deletedAt).toEqual(d1.deletedAt);
  });

  it("softDelete acepta fecha personalizada", () => {
    const panel = LabPanel.create(validInput());
    const now = new Date("2024-06-01");
    const deleted = panel.softDelete(now);
    expect(deleted.deletedAt?.getTime()).toBe(now.getTime());
  });

  it("withNotes actualiza las notas sin mutar original", () => {
    const panel = LabPanel.create(validInput());
    const updated = panel.withNotes("nuevas notas");
    expect(updated.notes).toBe("nuevas notas");
    expect(panel.notes).toBeNull();
  });

  it("withNotes acepta null", () => {
    const panel = LabPanel.create({ ...validInput(), notes: "original" });
    const updated = panel.withNotes(null);
    expect(updated.notes).toBeNull();
  });

  it("getValue retorna el valor de una prueba existente", () => {
    const panel = LabPanel.create(validInput());
    expect(panel.getValue("GLUCOSA")).toBe(90);
  });

  it("getValue retorna null para prueba ausente", () => {
    const panel = LabPanel.create(validInput());
    expect(panel.getValue("HDL")).toBeNull();
  });

  it("hasTest retorna true/false según corresponda", () => {
    const panel = LabPanel.create(validInput());
    expect(panel.hasTest("GLUCOSA")).toBe(true);
    expect(panel.hasTest("HDL")).toBe(false);
  });

  it("resultBytest mapea test -> resultado", () => {
    const panel = LabPanel.create(validInput());
    const map = panel.resultBytest;
    expect(map.get("GLUCOSA")?.value).toBe(90);
    expect(map.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// LabResult - classifyLabValue
// ---------------------------------------------------------------------------
describe("classifyLabValue", () => {
  const range = {
    test: "GLUCOSA",
    sex: "all" as const,
    low: 70,
    high: 100,
    criticalLow: 50,
    criticalHigh: 200,
  };

  it("retorna normal para valor dentro del rango", () => {
    expect(classifyLabValue(85, range)).toBe("normal");
  });

  it("retorna low para valor debajo del límite inferior", () => {
    expect(classifyLabValue(65, range)).toBe("low");
  });

  it("retorna high para valor sobre el límite superior", () => {
    expect(classifyLabValue(150, range)).toBe("high");
  });

  it("retorna critical-low para valor crítico bajo", () => {
    expect(classifyLabValue(40, range)).toBe("critical-low");
  });

  it("retorna critical-high para valor crítico alto", () => {
    expect(classifyLabValue(250, range)).toBe("critical-high");
  });

  it("retorna normal si no hay rango de referencia", () => {
    expect(classifyLabValue(999, null)).toBe("normal");
  });

  it("respeta criticalLow = null (cae a low)", () => {
    const r = { ...range, criticalLow: null };
    expect(classifyLabValue(40, r)).toBe("low");
  });

  it("respeta criticalHigh = null (cae a high)", () => {
    const r = { ...range, criticalHigh: null };
    expect(classifyLabValue(250, r)).toBe("high");
  });

  it("respeta low = null (no hay límite inferior)", () => {
    const r = { ...range, low: null, criticalLow: null };
    expect(classifyLabValue(0, r)).toBe("normal");
  });

  it("respeta high = null (no hay límite superior)", () => {
    const r = { ...range, high: null, criticalHigh: null };
    expect(classifyLabValue(9999, r)).toBe("normal");
  });
});

// ---------------------------------------------------------------------------
// LabResult - from() & flags
// ---------------------------------------------------------------------------
describe("LabResult.from", () => {
  it("crea resultado válido", () => {
    const r = LabResult.from({ test: "GLUCOSA", value: 90 });
    expect(r.test).toBe("GLUCOSA");
    expect(r.value).toBe(90);
  });

  it("rechaza NaN", () => {
    expect(() => LabResult.from({ test: "GLUCOSA", value: NaN })).toThrow();
  });

  it("rechaza Infinity", () => {
    expect(() => LabResult.from({ test: "GLUCOSA", value: Infinity })).toThrow();
  });

  it("crea con valor cero (válido)", () => {
    const r = LabResult.from({ test: "GLUCOSA", value: 0 });
    expect(r.value).toBe(0);
  });
});

describe("LabFlagLabel", () => {
  it("contiene todas las banderas con etiquetas en español", () => {
    expect(LabFlagLabel.normal).toBe("Normal");
    expect(LabFlagLabel.low).toBe("Bajo");
    expect(LabFlagLabel.high).toBe("Alto");
    expect(LabFlagLabel["critical-low"]).toBe("Crítico bajo");
    expect(LabFlagLabel["critical-high"]).toBe("Crítico alto");
  });
});

describe("LabFlagColor", () => {
  it("asigna colores correctos a cada bandera", () => {
    expect(LabFlagColor.normal).toBe("success");
    expect(LabFlagColor.low).toBe("warning");
    expect(LabFlagColor.high).toBe("warning");
    expect(LabFlagColor["critical-low"]).toBe("destructive");
    expect(LabFlagColor["critical-high"]).toBe("destructive");
  });
});

// ---------------------------------------------------------------------------
// LabTest - códigos, categorías, definiciones
// ---------------------------------------------------------------------------
describe("LabTestCodeSchema", () => {
  it("valida todos los códigos del catálogo", () => {
    for (const code of LAB_TEST_CODES) {
      expect(LabTestCodeSchema.safeParse(code).success).toBe(true);
    }
  });

  it("rechaza un código inválido", () => {
    expect(LabTestCodeSchema.safeParse("INVALIDO").success).toBe(false);
  });

  it("rechaza string vacío", () => {
    expect(LabTestCodeSchema.safeParse("").success).toBe(false);
  });
});

describe("LabTestCategorySchema", () => {
  it("valida todas las categorías", () => {
    const categories = [
      "glucosa",
      "lipidos",
      "renal",
      "hepatico",
      "proteinas",
      "hemograma",
      "hierro",
      "vitaminas",
      "tiroides",
      "otros",
    ] as const;
    for (const cat of categories) {
      expect(LabTestCategorySchema.safeParse(cat).success).toBe(true);
    }
  });

  it("rechaza categoría inválida", () => {
    expect(LabTestCategorySchema.safeParse("cardiovascular").success).toBe(
      false,
    );
  });
});

describe("LAB_TEST_DEFINITIONS", () => {
  it("todos los códigos tienen definición completa", () => {
    for (const code of LAB_TEST_CODES) {
      const def = LAB_TEST_DEFINITIONS[code];
      expect(def).toBeDefined();
      expect(def.name).toBeTruthy();
      expect(def.shortName).toBeTruthy();
      expect(def.category).toBeDefined();
      expect(def.unit).toBeTruthy();
      expect(typeof def.decimals).toBe("number");
    }
  });

  it("cada definición tiene un código consistente", () => {
    for (const code of LAB_TEST_CODES) {
      expect(LAB_TEST_DEFINITIONS[code].code).toBe(code);
    }
  });
});

describe("getLabTestDefinition", () => {
  it("retorna la definición correcta para GLUCOSA", () => {
    const def = getLabTestDefinition("GLUCOSA");
    expect(def.name).toBe("Glucosa en ayunas");
    expect(def.shortName).toBe("Glucosa");
    expect(def.unit).toBe("mg/dL");
    expect(def.decimals).toBe(0);
    expect(def.category).toBe("glucosa");
  });

  it("retorna la definición correcta para TSH", () => {
    const def = getLabTestDefinition("TSH");
    expect(def.name).toBe("Hormona estimulante de tiroides");
    expect(def.unit).toBe("µUI/mL");
    expect(def.decimals).toBe(2);
  });
});

describe("getLabTestsByCategory", () => {
  it("agrupa todas las pruebas por categoría", () => {
    const grouped = getLabTestsByCategory();
    expect(grouped.glucosa.length).toBeGreaterThanOrEqual(3);
    expect(grouped.lipidos.length).toBeGreaterThanOrEqual(4);
    expect(grouped.renal.length).toBeGreaterThanOrEqual(3);
    expect(grouped.hepatico.length).toBeGreaterThanOrEqual(4);
    expect(grouped.proteinas.length).toBeGreaterThanOrEqual(2);
    expect(grouped.hemograma.length).toBeGreaterThanOrEqual(2);
    expect(grouped.hierro.length).toBeGreaterThanOrEqual(2);
    expect(grouped.vitaminas.length).toBeGreaterThanOrEqual(3);
    expect(grouped.tiroides.length).toBeGreaterThanOrEqual(1);
  });

  it("cada prueba aparece exactamente una vez", () => {
    const grouped = getLabTestsByCategory();
    const all = Object.values(grouped).flat();
    expect(all.length).toBe(LAB_TEST_CODES.length);
  });
});

describe("LabTestCategoryLabel", () => {
  it("tiene etiquetas para todas las categorías", () => {
    expect(LabTestCategoryLabel.glucosa).toBe("Glucosa y metabolismo");
    expect(LabTestCategoryLabel.lipidos).toBe("Perfil lipídico");
    expect(LabTestCategoryLabel.renal).toBe("Función renal");
    expect(LabTestCategoryLabel.hepatico).toBe("Función hepática");
    expect(LabTestCategoryLabel.proteinas).toBe("Proteínas");
    expect(LabTestCategoryLabel.hemograma).toBe("Hemograma");
    expect(LabTestCategoryLabel.hierro).toBe("Metabolismo del hierro");
    expect(LabTestCategoryLabel.vitaminas).toBe("Vitaminas");
    expect(LabTestCategoryLabel.tiroides).toBe("Función tiroidea");
    expect(LabTestCategoryLabel.otros).toBe("Otros");
  });
});

// ---------------------------------------------------------------------------
// LabReferenceRange - findReferenceRange & LabValue
// ---------------------------------------------------------------------------
describe("findReferenceRange", () => {
  const ranges = [
    { test: "GLUCOSA", sex: "all" as const, low: 70, high: 100 },
    { test: "GLUCOSA", sex: "female" as const, low: 65, high: 95 },
    {
      test: "HEMOGLOBINA",
      sex: "male" as const,
      low: 13.5,
      high: 17.5,
      ageMinYears: 18,
    },
    {
      test: "HEMOGLOBINA",
      sex: "female" as const,
      low: 12,
      high: 16,
      ageMinYears: 18,
    },
    {
      test: "HEMOGLOBINA",
      sex: "all" as const,
      low: 11,
      high: 16,
      ageMinYears: 0,
      ageMaxYears: 17,
    },
  ];

  it("encuentra rango exacto por sexo", () => {
    const r = findReferenceRange("GLUCOSA", "female", 30, ranges);
    expect(r?.low).toBe(65);
    expect(r?.high).toBe(95);
  });

  it("cae a 'all' si no hay rango específico para el sexo", () => {
    const r = findReferenceRange("GLUCOSA", "male", 30, ranges);
    expect(r?.low).toBe(70);
    expect(r?.high).toBe(100);
  });

  it("filtra por edad correctamente (adulto)", () => {
    const r = findReferenceRange("HEMOGLOBINA", "male", 25, ranges);
    expect(r?.low).toBe(13.5);
  });

  it("usa rango infantil si la edad está en ese grupo", () => {
    const r = findReferenceRange("HEMOGLOBINA", "female", 10, ranges);
    expect(r?.low).toBe(11);
  });

  it("retorna null si no hay rango para el test", () => {
    const r = findReferenceRange("TSH", "male", 30, ranges);
    expect(r).toBeNull();
  });

  it("excluye rangos fuera del grupo de edad", () => {
    const r = findReferenceRange("HEMOGLOBINA", "male", 10, ranges);
    expect(r?.low).toBe(11);
    expect(r?.high).toBe(16);
  });

  it("trata sex 'other' como 'all'", () => {
    const r = findReferenceRange("GLUCOSA", "other" as any, 30, ranges);
    expect(r?.low).toBe(70);
  });
});

describe("LabValue", () => {
  it("crea valor válido desde un código conocido", () => {
    const v = LabValue.from("GLUCOSA", 100);
    expect(v.numericValue).toBe(100);
  });

  it("formatted usa la cantidad de decimales del test", () => {
    const glucosa = LabValue.from("GLUCOSA", 100);
    expect(glucosa.formatted()).toBe("100");

    const creatinina = LabValue.from("CREATININA", 0.85);
    expect(creatinina.formatted()).toBe("0.85");

    const tsh = LabValue.from("TSH", 2.5);
    expect(tsh.formatted()).toBe("2.50");
  });

  it("unit retorna la unidad del test", () => {
    const v = LabValue.from("GLUCOSA", 90);
    expect(v.unit()).toBe("mg/dL");
  });

  it("rechaza NaN", () => {
    expect(() => LabValue.from("GLUCOSA", NaN)).toThrow();
  });

  it("rechaza Infinity", () => {
    expect(() => LabValue.from("GLUCOSA", Infinity)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// LabPanelId
// ---------------------------------------------------------------------------
describe("LabPanelId", () => {
  const VALID_UUID_V7 = "0194f2a0-7b3f-7d00-8000-000000000000";

  it("generate crea UUIDv7 válido", () => {
    const id = LabPanelId.generate();
    expect(id.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("generate produce ids distintos", () => {
    const a = LabPanelId.generate();
    const b = LabPanelId.generate();
    expect(a.value).not.toBe(b.value);
  });

  it("from acepta UUIDv7 válido", () => {
    const id = LabPanelId.from(VALID_UUID_V7);
    expect(id.value).toBe(VALID_UUID_V7);
  });

  it("from rechaza UUID que no es v7", () => {
    expect(() => LabPanelId.from("invalido")).toThrow(/LabPanelId/);
  });

  it("from rechaza UUID v4", () => {
    expect(() =>
      LabPanelId.from("550e8400-e29b-41d4-a716-446655440000"),
    ).toThrow();
  });

  it("from rechaza string vacío", () => {
    expect(() => LabPanelId.from("")).toThrow();
  });

  it("fromUnsafe no valida el formato", () => {
    const id = LabPanelId.fromUnsafe("cualquier-cosa");
    expect(id.value).toBe("cualquier-cosa");
  });

  it("equals retorna true para mismo valor", () => {
    const a = LabPanelId.from(VALID_UUID_V7);
    const b = LabPanelId.from(VALID_UUID_V7);
    expect(a.equals(b)).toBe(true);
  });

  it("equals retorna false para valores distintos", () => {
    const a = LabPanelId.generate();
    const b = LabPanelId.generate();
    expect(a.equals(b)).toBe(false);
  });

  it("toString devuelve el valor", () => {
    const id = LabPanelId.from(VALID_UUID_V7);
    expect(id.toString()).toBe(VALID_UUID_V7);
  });
});

// ---------------------------------------------------------------------------
// LabPanelRepository - error classes
// ---------------------------------------------------------------------------
describe("LabPanelNotFoundError", () => {
  it("tiene nombre y mensaje correctos", () => {
    const id = LabPanelId.generate();
    const error = new LabPanelNotFoundError(id);
    expect(error.name).toBe("LabPanelNotFoundError");
    expect(error.message).toContain(id.toString());
    expect(error.id).toBe(id);
  });

  it("es instancia de Error", () => {
    const error = new LabPanelNotFoundError(LabPanelId.generate());
    expect(error).toBeInstanceOf(Error);
  });
});

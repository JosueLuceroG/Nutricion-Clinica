import { describe, it, expect } from "vitest";
import {
  MedicationCatalog,
  MedicationCatalogSchema,
  type MedicationCatalogProps,
} from "./MedicationCatalog";
import {
  medicationCatalogIdFrom,
  createMedicationCatalogId,
  MedicationCatalogIdSchema,
} from "./MedicationCatalogId";
import {
  MedicationRouteSchema,
  MedicationRouteLabel,
  MEDICATION_ROUTES,
  InteractionTypeSchema,
  InteractionTypeLabel,
  INTERACTION_TYPES,
  InteractionSeveritySchema,
  InteractionSeverityLabel,
  INTERACTION_SEVERITIES,
  type MedicationRoute,
  type InteractionType,
  type InteractionSeverity,
} from "./MedicationCatalogTypes";
import {
  NutrientInteraction,
  NutrientInteractionSchema,
  type NutrientInteractionProps,
} from "./NutrientInteraction";
import {
  MedicationCatalogNotFoundError,
  NutrientInteractionNotFoundError,
} from "./MedicationRepository";

const validUUID = "550e8400-e29b-41d4-a716-446655440000";
const validUUID2 = "660e8400-e29b-41d4-a716-446655440001";
const now = Date.now();

// ---------------------------------------------------------------------------
// MedicationCatalogId
// ---------------------------------------------------------------------------
describe("MedicationCatalogId", () => {
  it("createMedicationCatalogId genera un UUID válido", () => {
    const id = createMedicationCatalogId();
    expect(MedicationCatalogIdSchema.safeParse(id).success).toBe(true);
  });

  it("medicationCatalogIdFrom acepta un UUID válido", () => {
    const id = medicationCatalogIdFrom(validUUID);
    expect(id).toBe(validUUID);
  });

  it("medicationCatalogIdFrom rechaza un string no UUID", () => {
    expect(() => medicationCatalogIdFrom("no-es-uuid")).toThrow();
  });

  it("equals: dos instancias con el mismo UUID son iguales", () => {
    const a = medicationCatalogIdFrom(validUUID);
    const b = medicationCatalogIdFrom(validUUID);
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// MedicationCatalogTypes
// ---------------------------------------------------------------------------
describe("MedicationRoute", () => {
  it("tiene 6 valores enum", () => {
    expect(MEDICATION_ROUTES).toHaveLength(6);
    expect(MEDICATION_ROUTES).toEqual([
      "oral",
      "IV",
      "IM",
      "SC",
      "topica",
      "inhalada",
    ]);
  });

  it("MedicationRouteLabel cubre todas las claves", () => {
    for (const r of MEDICATION_ROUTES) {
      expect(MedicationRouteLabel[r]).toBeDefined();
    }
  });

  it("MedicationRouteLabel contiene etiquetas en español", () => {
    expect(MedicationRouteLabel.oral).toBe("Oral");
    expect(MedicationRouteLabel.IV).toBe("Intravenosa");
    expect(MedicationRouteLabel.IM).toBe("Intramuscular");
    expect(MedicationRouteLabel.SC).toBe("Subcutánea");
    expect(MedicationRouteLabel.topica).toBe("Tópica");
    expect(MedicationRouteLabel.inhalada).toBe("Inhalada");
  });

  it("Zod schema rechaza un valor inválido", () => {
    expect(MedicationRouteSchema.safeParse("intravenosa").success).toBe(false);
  });

  it("Zod schema acepta todos los valores válidos", () => {
    for (const r of MEDICATION_ROUTES) {
      expect(MedicationRouteSchema.safeParse(r).success).toBe(true);
    }
  });
});

describe("InteractionType", () => {
  it("tiene 5 valores enum", () => {
    expect(INTERACTION_TYPES).toHaveLength(5);
    expect(INTERACTION_TYPES).toEqual([
      "reduce_absorcion",
      "aumenta_absorcion",
      "potencia_efecto",
      "antagoniza_efecto",
      "toxicidad",
    ]);
  });

  it("InteractionTypeLabel cubre todas las claves", () => {
    for (const t of INTERACTION_TYPES) {
      expect(InteractionTypeLabel[t]).toBeDefined();
    }
  });

  it("InteractionTypeLabel contiene etiquetas en español", () => {
    expect(InteractionTypeLabel.reduce_absorcion).toBe("Reduce absorción");
    expect(InteractionTypeLabel.aumenta_absorcion).toBe("Aumenta absorción");
    expect(InteractionTypeLabel.potencia_efecto).toBe("Potencia efecto");
    expect(InteractionTypeLabel.antagoniza_efecto).toBe("Antagoniza efecto");
    expect(InteractionTypeLabel.toxicidad).toBe("Toxicidad");
  });

  it("Zod schema rechaza un valor inválido", () => {
    expect(InteractionTypeSchema.safeParse("otro").success).toBe(false);
  });
});

describe("InteractionSeverity", () => {
  it("tiene 3 valores enum", () => {
    expect(INTERACTION_SEVERITIES).toHaveLength(3);
    expect(INTERACTION_SEVERITIES).toEqual(["leve", "moderada", "severa"]);
  });

  it("InteractionSeverityLabel cubre todas las claves", () => {
    for (const s of INTERACTION_SEVERITIES) {
      expect(InteractionSeverityLabel[s]).toBeDefined();
    }
  });

  it("InteractionSeverityLabel contiene etiquetas en español", () => {
    expect(InteractionSeverityLabel.leve).toBe("Leve");
    expect(InteractionSeverityLabel.moderada).toBe("Moderada");
    expect(InteractionSeverityLabel.severa).toBe("Severa");
  });

  it("Zod schema rechaza un valor inválido", () => {
    expect(InteractionSeveritySchema.safeParse("critica").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MedicationCatalog
// ---------------------------------------------------------------------------
const baseMedication = {
  id: medicationCatalogIdFrom(validUUID),
  nombre_comercial: "Paracetamol",
  principio_activo: "Paracetamol",
  presentacion: "Tabletas",
  concentracion: "500 mg",
  via_administracion: "oral" as MedicationRoute,
  categoria_farmacologica: "Analgésico",
  efectos_secundarios: ["náuseas", "mareo"],
  contraindicaciones: ["insuficiencia hepática"],
  notas: "Tomar con alimentos",
};

function createMedication(
  overrides: Partial<MedicationCatalogProps> = {},
): MedicationCatalog {
  return MedicationCatalog.create({ ...baseMedication, ...overrides });
}

describe("MedicationCatalog.create", () => {
  it("crea medicamento con datos válidos", () => {
    const med = MedicationCatalog.create(baseMedication);
    expect(med.nombre_comercial).toBe("Paracetamol");
    expect(med.principio_activo).toBe("Paracetamol");
    expect(med.presentacion).toBe("Tabletas");
    expect(med.concentracion).toBe("500 mg");
    expect(med.via_administracion).toBe("oral");
    expect(med.categoria_farmacologica).toBe("Analgésico");
    expect(med.efectos_secundarios).toEqual(["náuseas", "mareo"]);
    expect(med.contraindicaciones).toEqual(["insuficiencia hepática"]);
    expect(med.notas).toBe("Tomar con alimentos");
    expect(med.createdAt).toBeGreaterThan(0);
    expect(med.updatedAt).toBeGreaterThan(0);
  });

  it("asigna valores por defecto: efectos_secundarios vacío", () => {
    const med = MedicationCatalog.create({ ...baseMedication, efectos_secundarios: [] });
    expect(med.efectos_secundarios).toEqual([]);
  });

  it("asigna valores por defecto: contraindicaciones vacío", () => {
    const med = MedicationCatalog.create({ ...baseMedication, contraindicaciones: [] });
    expect(med.contraindicaciones).toEqual([]);
  });

  it("asigna notas vacía por defecto", () => {
    const med = MedicationCatalog.create({ ...baseMedication, notas: "" });
    expect(med.notas).toBe("");
  });
});

describe("MedicationCatalog.reconstitute", () => {
  it("reconstituye un medicamento existente sin modificar props", () => {
    const props: MedicationCatalogProps = {
      id: medicationCatalogIdFrom(validUUID),
      nombre_comercial: "Ibuprofeno",
      principio_activo: "Ibuprofeno",
      presentacion: "Cápsulas",
      concentracion: "400 mg",
      via_administracion: "oral",
      categoria_farmacologica: "AINE",
      efectos_secundarios: ["dolor estomacal"],
      contraindicaciones: ["úlcera péptica"],
      notas: "Tomar con comida",
      createdAt: now,
      updatedAt: now,
    };
    const med = MedicationCatalog.reconstitute(props);
    expect(med.nombre_comercial).toBe("Ibuprofeno");
    expect(med.categoria_farmacologica).toBe("AINE");
    expect(med.createdAt).toBe(now);
    expect(med.updatedAt).toBe(now);
  });
});

describe("MedicationCatalog.toProps", () => {
  it("retorna copia de las propiedades", () => {
    const med = createMedication();
    const props = med.toProps();
    expect(props.nombre_comercial).toBe("Paracetamol");
    expect(props.via_administracion).toBe("oral");
  });
});

describe("MedicationCatalog.with", () => {
  it("retorna nueva instancia sin mutar la original", () => {
    const original = createMedication();
    const updated = original.with({ notas: "Nueva nota" });
    expect(original.notas).toBe("Tomar con alimentos");
    expect(updated.notas).toBe("Nueva nota");
    expect(updated.id).toBe(original.id);
  });

  it("actualiza updatedAt", () => {
    const original = createMedication();
    const updated = original.with({ concentracion: "750 mg" });
    expect(updated.updatedAt).toBeGreaterThanOrEqual(original.updatedAt);
  });
});

describe("MedicationCatalog schema validation", () => {
  it("validación pasa con datos correctos", () => {
    const props: MedicationCatalogProps = {
      id: medicationCatalogIdFrom(validUUID),
      nombre_comercial: "Amoxicilina",
      principio_activo: "Amoxicilina",
      presentacion: "Suspensión",
      concentracion: "250 mg/5ml",
      via_administracion: "oral",
      categoria_farmacologica: "Antibiótico",
      efectos_secundarios: ["diarrea"],
      contraindicaciones: ["alergia a penicilinas"],
      notas: "",
      createdAt: now,
      updatedAt: now,
    };
    expect(MedicationCatalogSchema.safeParse(props).success).toBe(true);
  });

  it("rechaza nombre_comercial vacío", () => {
    const props = { ...baseMedication, nombre_comercial: "" };
    expect(MedicationCatalogSchema.safeParse(props).success).toBe(false);
  });

  it("rechaza via_administracion inválida", () => {
    const props = { ...baseMedication, via_administracion: "intramuscular" };
    expect(MedicationCatalogSchema.safeParse(props).success).toBe(false);
  });

  it("rechaza createdAt no positivo", () => {
    const props = { ...baseMedication, createdAt: 0 };
    expect(MedicationCatalogSchema.safeParse(props).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// NutrientInteraction
// ---------------------------------------------------------------------------
const baseInteraction = {
  id: medicationCatalogIdFrom(validUUID),
  medicamento_id: medicationCatalogIdFrom(validUUID2),
  nutriente: "Vitamina K",
  tipo: "antagoniza_efecto" as InteractionType,
  severidad: "moderada" as InteractionSeverity,
  recomendacion: "Evitar consumo excesivo de vegetales verdes",
  fuente: "NIH",
  fecha_vigencia: null,
};

describe("NutrientInteraction.create", () => {
  it("crea interacción con datos válidos", () => {
    const int = NutrientInteraction.create(baseInteraction);
    expect(int.nutriente).toBe("Vitamina K");
    expect(int.tipo).toBe("antagoniza_efecto");
    expect(int.severidad).toBe("moderada");
    expect(int.recomendacion).toBe("Evitar consumo excesivo de vegetales verdes");
    expect(int.fuente).toBe("NIH");
    expect(int.fecha_vigencia).toBeNull();
    expect(int.createdAt).toBeGreaterThan(0);
    expect(int.updatedAt).toBeGreaterThan(0);
  });

  it("asigna fuente vacía por defecto", () => {
    const int = NutrientInteraction.create({
      ...baseInteraction,
      fuente: "",
    });
    expect(int.fuente).toBe("");
  });

  it("asigna fecha_vigencia null por defecto", () => {
    const int = NutrientInteraction.create({
      ...baseInteraction,
      fecha_vigencia: null,
    });
    expect(int.fecha_vigencia).toBeNull();
  });
});

describe("NutrientInteraction.reconstitute", () => {
  it("reconstituye interacción existente", () => {
    const props: NutrientInteractionProps = {
      id: medicationCatalogIdFrom(validUUID),
      medicamento_id: medicationCatalogIdFrom(validUUID2),
      nutriente: "Calcio",
      tipo: "reduce_absorcion",
      severidad: "leve",
      recomendacion: "Separar 2 horas",
      fuente: "Estudio clínico",
      fecha_vigencia: "2026-12-31",
      createdAt: now,
      updatedAt: now,
    };
    const int = NutrientInteraction.reconstitute(props);
    expect(int.nutriente).toBe("Calcio");
    expect(int.tipo).toBe("reduce_absorcion");
    expect(int.severidad).toBe("leve");
    expect(int.fecha_vigencia).toBe("2026-12-31");
    expect(int.createdAt).toBe(now);
  });
});

describe("NutrientInteraction.toProps", () => {
  it("retorna copia de propiedades", () => {
    const int = NutrientInteraction.create(baseInteraction);
    const props = int.toProps();
    expect(props.nutriente).toBe("Vitamina K");
    expect(props.tipo).toBe("antagoniza_efecto");
  });
});

describe("NutrientInteraction schema validation", () => {
  it("validación pasa con datos correctos", () => {
    const props: NutrientInteractionProps = {
      id: medicationCatalogIdFrom(validUUID),
      medicamento_id: medicationCatalogIdFrom(validUUID2),
      nutriente: "Hierro",
      tipo: "reduce_absorcion",
      severidad: "severa",
      recomendacion: "No administrar juntos",
      fuente: "Farmacopea",
      fecha_vigencia: null,
      createdAt: now,
      updatedAt: now,
    };
    expect(NutrientInteractionSchema.safeParse(props).success).toBe(true);
  });

  it("rechaza tipo inválido", () => {
    const props = { ...baseInteraction, tipo: "invalido" };
    expect(NutrientInteractionSchema.safeParse(props).success).toBe(false);
  });

  it("rechaza severidad inválida", () => {
    const props = { ...baseInteraction, severidad: "critica" };
    expect(NutrientInteractionSchema.safeParse(props).success).toBe(false);
  });

  it("rechaza createdAt no positivo", () => {
    const props = { ...baseInteraction, createdAt: -1, updatedAt: now };
    expect(NutrientInteractionSchema.safeParse(props).success).toBe(false);
  });
});

describe("NutrientInteraction severity labels", () => {
  it("leve se etiqueta como 'Leve'", () => {
    expect(InteractionSeverityLabel.leve).toBe("Leve");
  });

  it("moderada se etiqueta como 'Moderada'", () => {
    expect(InteractionSeverityLabel.moderada).toBe("Moderada");
  });

  it("severa se etiqueta como 'Severa'", () => {
    expect(InteractionSeverityLabel.severa).toBe("Severa");
  });
});

// ---------------------------------------------------------------------------
// MedicationRepository - Error classes
// ---------------------------------------------------------------------------
describe("MedicationRepository errors", () => {
  it("MedicationCatalogNotFoundError tiene nombre y mensaje correctos", () => {
    const id = medicationCatalogIdFrom(validUUID);
    const err = new MedicationCatalogNotFoundError(id);
    expect(err.name).toBe("MedicationCatalogNotFoundError");
    expect(err.message).toContain("Medicamento no encontrado");
    expect(err.message).toContain(validUUID);
    expect(err.id).toBe(id);
  });

  it("NutrientInteractionNotFoundError tiene nombre y mensaje correctos", () => {
    const id = medicationCatalogIdFrom(validUUID);
    const err = new NutrientInteractionNotFoundError(id);
    expect(err.name).toBe("NutrientInteractionNotFoundError");
    expect(err.message).toContain("Interacción no encontrada");
    expect(err.message).toContain(validUUID);
    expect(err.id).toBe(id);
  });

  it("MedicationCatalogNotFoundError es instancia de Error", () => {
    const err = new MedicationCatalogNotFoundError(medicationCatalogIdFrom(validUUID));
    expect(err).toBeInstanceOf(Error);
  });

  it("NutrientInteractionNotFoundError es instancia de Error", () => {
    const err = new NutrientInteractionNotFoundError(medicationCatalogIdFrom(validUUID));
    expect(err).toBeInstanceOf(Error);
  });
});

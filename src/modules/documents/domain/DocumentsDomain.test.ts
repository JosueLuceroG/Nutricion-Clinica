import { describe, it, expect } from "vitest";
import { DocumentIdSchema, createDocumentId, documentIdFrom, documentIdFromUnsafe } from "./DocumentId";
import { DocumentTypeSchema, DocumentTypeLabel, DocumentStatusSchema, DocumentStatusLabel } from "./DocumentTypes";
import { DocumentSchema, NutriClinicaDocument } from "./NutriClinicaDocument";
import { DocumentNotFoundError } from "./DocumentRepository";

describe("DocumentId", () => {
  it("genera un UUID válido", () => {
    const id = createDocumentId();
    expect(DocumentIdSchema.safeParse(id).success).toBe(true);
  });

  it("from acepta un UUID válido", () => {
    const uuid = crypto.randomUUID();
    const id = documentIdFrom(uuid);
    expect(id).toBe(uuid);
  });

  it("from rechaza un UUID inválido", () => {
    expect(() => documentIdFrom("no-es-uuid")).toThrow();
  });

  it("fromUnsafe no valida", () => {
    const id = documentIdFromUnsafe("lo-que-sea");
    expect(id).toBe("lo-que-sea");
  });
});

describe("DocumentTypes", () => {
  it("tiene labels para todos los tipos de documento", () => {
    const values = DocumentTypeSchema.options;
    for (const v of values) {
      expect(DocumentTypeLabel[v]).toBeDefined();
      expect(DocumentTypeLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("tiene labels para todos los estados de documento", () => {
    const values = DocumentStatusSchema.options;
    for (const v of values) {
      expect(DocumentStatusLabel[v]).toBeDefined();
      expect(DocumentStatusLabel[v].length).toBeGreaterThan(0);
    }
  });

  it("exhaustividad: todos los tipos tienen label", () => {
    expect(Object.keys(DocumentTypeLabel).sort()).toEqual(
      [...DocumentTypeSchema.options].sort(),
    );
  });

  it("exhaustividad: todos los estados tienen label", () => {
    expect(Object.keys(DocumentStatusLabel).sort()).toEqual(
      [...DocumentStatusSchema.options].sort(),
    );
  });
});

describe("NutriClinicaDocument", () => {
  const validProps = () => ({
    id: createDocumentId(),
    patientId: crypto.randomUUID(),
    consultationId: crypto.randomUUID(),
    type: "clinical_report" as const,
    title: "Reporte de evolución",
    contentHtml: "<p>Contenido del reporte</p>",
    parameters: '{"template":"estandar"}',
    status: "draft" as const,
    generatedBy: crypto.randomUUID(),
    generatedAt: Date.now(),
    version: 1,
    voidReason: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  it("acepta props válidos en el schema", () => {
    const result = DocumentSchema.safeParse(validProps());
    expect(result.success).toBe(true);
  });

  it("rechaza type inválido", () => {
    const result = DocumentSchema.safeParse({ ...validProps(), type: "factura" });
    expect(result.success).toBe(false);
  });

  it("rechaza status inválido", () => {
    const result = DocumentSchema.safeParse({ ...validProps(), status: "cancelado" });
    expect(result.success).toBe(false);
  });

  it("rechaza title vacío", () => {
    const result = DocumentSchema.safeParse({ ...validProps(), title: "" });
    expect(result.success).toBe(false);
  });

  it("rechaza title demasiado largo", () => {
    const result = DocumentSchema.safeParse({ ...validProps(), title: "X".repeat(301) });
    expect(result.success).toBe(false);
  });

  it("rechaza id no UUID", () => {
    const result = DocumentSchema.safeParse({ ...validProps(), id: "no-uuid" });
    expect(result.success).toBe(false);
  });

  it("aplica defaults para contentHtml y parameters", () => {
    const result = DocumentSchema.parse({
      ...validProps(),
      contentHtml: undefined,
      parameters: undefined,
    });
    expect(result.contentHtml).toBe("");
    expect(result.parameters).toBe("{}");
  });

  it("create asigna draft, version 1, voidReason vacío y timestamps", () => {
    const doc = NutriClinicaDocument.create({
      id: createDocumentId().toString(),
      type: "meal_plan",
      title: "Plan de alimentación",
      generatedBy: crypto.randomUUID(),
      contentHtml: "",
      parameters: "{}",
    });
    expect(doc.status).toBe("draft");
    expect(doc.version).toBe(1);
    expect(doc.voidReason).toBe("");
    expect(doc.generatedAt).toBeGreaterThan(0);
    expect(doc.createdAt).toBeGreaterThan(0);
    expect(doc.updatedAt).toBeGreaterThan(0);
  });

  it("create acepta status explícito", () => {
    const doc = NutriClinicaDocument.create({
      id: createDocumentId().toString(),
      type: "consent",
      title: "Consentimiento informado",
      generatedBy: crypto.randomUUID(),
      status: "signed",
      contentHtml: "",
      parameters: "{}",
    });
    expect(doc.status).toBe("signed");
  });

  it("reconstitute restaura desde props", () => {
    const props = validProps();
    const doc = NutriClinicaDocument.reconstitute(props);
    expect(doc.id).toBe(props.id);
    expect(doc.title).toBe("Reporte de evolución");
    expect(doc.type).toBe("clinical_report");
    expect(doc.status).toBe("draft");
  });

  it("toProps devuelve copia de las props", () => {
    const original = NutriClinicaDocument.reconstitute(validProps());
    const props = original.toProps();
    expect(props.id).toBe(original.id);
    expect(props.title).toBe(original.title);
  });

  it("sign cambia estado a signed y asigna metadatos de firma", () => {
    const doc = NutriClinicaDocument.reconstitute(validProps());
    const signedBy = crypto.randomUUID();
    const hash = "sha256-abc123";
    const signed = doc.sign(signedBy, hash);
    expect(signed.status).toBe("signed");
    expect(signed.signedBy).toBe(signedBy);
    expect(signed.signatureHash).toBe(hash);
    expect(signed.signedAt).toBeGreaterThan(0);
  });

  it("deliver cambia estado a delivered", () => {
    const doc = NutriClinicaDocument.reconstitute(validProps());
    const delivered = doc.deliver();
    expect(delivered.status).toBe("delivered");
  });

  it("void cambia estado a voided y guarda la razón", () => {
    const doc = NutriClinicaDocument.reconstitute(validProps());
    const voided = doc.void("Error en el contenido");
    expect(voided.status).toBe("voided");
    expect(voided.voidReason).toBe("Error en el contenido");
  });

  it("with actualiza campos y updatedAt", () => {
    const doc = NutriClinicaDocument.reconstitute({ ...validProps(), updatedAt: 1 });
    const updated = doc.with({ title: "Nuevo título", version: 2 });
    expect(updated.title).toBe("Nuevo título");
    expect(updated.version).toBe(2);
    expect(updated.updatedAt).toBeGreaterThan(doc.updatedAt);
  });

  it("valida metadatos de archivo - patientId y consultationId opcionales", () => {
    const doc = NutriClinicaDocument.reconstitute({
      ...validProps(),
      patientId: undefined,
      consultationId: undefined,
    });
    expect(doc.patientId).toBeUndefined();
    expect(doc.consultationId).toBeUndefined();
  });

  it("valida que version sea positiva", () => {
    const result = DocumentSchema.safeParse({ ...validProps(), version: 0 });
    expect(result.success).toBe(false);
  });
});

describe("DocumentRepository - error classes", () => {
  it("DocumentNotFoundError tiene el mensaje correcto", () => {
    const id = createDocumentId();
    const error = new DocumentNotFoundError(id);
    expect(error.message).toContain(id);
    expect(error.name).toBe("DocumentNotFoundError");
    expect(error.id).toBe(id);
    expect(error).toBeInstanceOf(Error);
  });
});

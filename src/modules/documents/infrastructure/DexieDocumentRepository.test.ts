import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexieDocumentRepository } from "./DexieDocumentRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { NutriClinicaDocument } from "../domain/NutriClinicaDocument";
import { createDocumentId } from "../domain/DocumentId";

describe("DexieDocumentRepository", () => {
  let repo: DexieDocumentRepository;
  let db: NutriClinicaDB;
  const patientId = crypto.randomUUID();
  const generatedBy = crypto.randomUUID();

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-doc-${Math.random().toString(36).slice(2)}`);
    await db.delete();
    db = new NutriClinicaDB(`test-doc-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieDocumentRepository(db);
  });

  it("guarda y recupera un documento por id", async () => {
    const doc = NutriClinicaDocument.create({
      id: createDocumentId(),
      patientId,
      type: "clinical_report",
      title: "Reporte inicial",
      generatedBy,
      contentHtml: "",
      parameters: "{}",
    });
    await repo.save(doc);

    const found = await repo.findById(doc.id);
    expect(found).not.toBeNull();
    expect(found?.title).toBe("Reporte inicial");
    expect(found?.type).toBe("clinical_report");
  });

  it("retorna null cuando el documento no existe", async () => {
    const found = await repo.findById(createDocumentId());
    expect(found).toBeNull();
  });

  it("findByPatient filtra por paciente", async () => {
    const otherPid = crypto.randomUUID();
    await repo.save(NutriClinicaDocument.create({
      id: createDocumentId(), patientId, type: "meal_plan", title: "Plan A", generatedBy,
      contentHtml: "", parameters: "{}",
    }));
    await repo.save(NutriClinicaDocument.create({
      id: createDocumentId(), patientId: otherPid, type: "meal_plan", title: "Plan B", generatedBy,
      contentHtml: "", parameters: "{}",
    }));

    const docs = await repo.findByPatient(patientId);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.title).toBe("Plan A");
  });

  it("findByType filtra por tipo", async () => {
    await repo.save(NutriClinicaDocument.create({
      id: createDocumentId(), patientId, type: "consent", title: "Consentimiento", generatedBy,
      contentHtml: "", parameters: "{}",
    }));
    await repo.save(NutriClinicaDocument.create({
      id: createDocumentId(), patientId, type: "referral", title: "Derivación", generatedBy,
      contentHtml: "", parameters: "{}",
    }));

    const consents = await repo.findByType("consent");
    expect(consents).toHaveLength(1);
    expect(consents[0]?.title).toBe("Consentimiento");
  });

  it("elimina un documento", async () => {
    const doc = NutriClinicaDocument.create({
      id: createDocumentId(), patientId, type: "clinical_report", title: "Temp", generatedBy,
      contentHtml: "", parameters: "{}",
    });
    await repo.save(doc);
    await repo.delete(doc.id);

    const found = await repo.findById(doc.id);
    expect(found).toBeNull();
  });
});

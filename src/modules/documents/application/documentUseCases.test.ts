import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  createDocumentUC,
  signDocumentUC,
  deliverDocumentUC,
  voidDocumentUC,
  listDocumentsUC,
} from "./documentUseCases";
import { DexieDocumentRepository } from "../infrastructure/DexieDocumentRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { createDocumentId } from "../domain/DocumentId";

describe("documentUseCases", () => {
  let repo: DexieDocumentRepository;
  let db: NutriClinicaDB;
  const patientId = crypto.randomUUID();
  const generatedBy = crypto.randomUUID();

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-doc-uc-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexieDocumentRepository(db);
  });

  it("createDocumentUC crea con tipo y status correctos", async () => {
    const doc = await createDocumentUC(repo, {
      patientId,
      type: "meal_plan",
      title: "Plan de alimentación",
      contentHtml: "",
      parameters: "{}",
    }, generatedBy);

    expect(doc.type).toBe("meal_plan");
    expect(doc.status).toBe("draft");
    expect(doc.generatedBy).toBe(generatedBy);
  });

  it("signDocumentUC actualiza status a signed con hash", async () => {
    const doc = await createDocumentUC(repo, {
      patientId, type: "consent", title: "Consentimiento informado",
      contentHtml: "", parameters: "{}",
    }, generatedBy);

    const signedBy = crypto.randomUUID();
    const signed = await signDocumentUC(repo, doc.id, signedBy, "sha256:abc123");

    expect(signed.status).toBe("signed");
    expect(signed.signedBy).toBe(signedBy);
    expect(signed.signatureHash).toBe("sha256:abc123");
    expect(signed.signedAt).toBeGreaterThan(0);
  });

  it("deliverDocumentUC actualiza status a delivered", async () => {
    const doc = await createDocumentUC(repo, {
      patientId, type: "clinical_report", title: "Reporte",
      contentHtml: "", parameters: "{}",
    }, generatedBy);

    const delivered = await deliverDocumentUC(repo, doc.id);
    expect(delivered.status).toBe("delivered");
  });

  it("voidDocumentUC actualiza status a voided con razón", async () => {
    const doc = await createDocumentUC(repo, {
      patientId, type: "referral", title: "Derivación",
      contentHtml: "", parameters: "{}",
    }, generatedBy);

    const voided = await voidDocumentUC(repo, doc.id, "Documento duplicado");
    expect(voided.status).toBe("voided");
    expect(voided.voidReason).toBe("Documento duplicado");
  });

  it("listDocumentsUC retorna todos los documentos", async () => {
    await createDocumentUC(repo, {
      patientId, type: "consent", title: "Doc 1",
      contentHtml: "", parameters: "{}",
    }, generatedBy);
    await createDocumentUC(repo, {
      patientId, type: "meal_plan", title: "Doc 2",
      contentHtml: "", parameters: "{}",
    }, generatedBy);

    const docs = await listDocumentsUC(repo);
    expect(docs).toHaveLength(2);
  });

  it("signDocumentUC lanza error si no existe", async () => {
    await expect(signDocumentUC(repo, createDocumentId(), crypto.randomUUID(), "hash"))
      .rejects.toThrow("Documento no encontrado");
  });
});

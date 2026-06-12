import { db } from "@services/db/dexieSchema";
import { DexieDocumentRepository } from "@modules/documents/infrastructure/DexieDocumentRepository";
import {
  createDocumentUC, listDocumentsUC, getDocumentByIdUC,
  deleteDocumentUC, signDocumentUC, deliverDocumentUC, voidDocumentUC,
} from "@modules/documents/application/documentUseCases";
import type { DocumentId } from "@modules/documents/domain/DocumentId";
import type { NutriClinicaDocument } from "@modules/documents/domain/NutriClinicaDocument";
import type { DocumentFormInput } from "@modules/documents/application/documentFormSchema";
import { recordClinicalAudit } from "@services/audit/clinicalAudit";

const repository = new DexieDocumentRepository(db);

export const documentService = {
  create: async (input: DocumentFormInput, generatedBy: string): Promise<NutriClinicaDocument> => {
    const document = await createDocumentUC(repository, input, generatedBy);
    await recordClinicalAudit({ module: "documents", action: "create", resourceType: "document", resourceId: document.id.toString(), patientId: document.patientId ?? null });
    return document;
  },
  list: (): Promise<NutriClinicaDocument[]> => listDocumentsUC(repository),
  getById: (id: DocumentId): Promise<NutriClinicaDocument | null> => getDocumentByIdUC(repository, id),
  delete: async (id: DocumentId): Promise<void> => {
    const existing = await repository.findById(id);
    await deleteDocumentUC(repository, id);
    if (existing) {
      await recordClinicalAudit({ module: "documents", action: "remove", resourceType: "document", resourceId: id.toString(), patientId: existing.patientId ?? null });
    }
  },
  sign: async (id: DocumentId, signedBy: string, hash: string): Promise<NutriClinicaDocument> => {
    const document = await signDocumentUC(repository, id, signedBy, hash);
    await recordClinicalAudit({ module: "documents", action: "sign", resourceType: "document", resourceId: document.id.toString(), patientId: document.patientId ?? null });
    return document;
  },
  deliver: async (id: DocumentId): Promise<NutriClinicaDocument> => {
    const document = await deliverDocumentUC(repository, id);
    await recordClinicalAudit({ module: "documents", action: "update", resourceType: "document", resourceId: document.id.toString(), patientId: document.patientId ?? null, justification: "deliver" });
    return document;
  },
  void: async (id: DocumentId, reason: string): Promise<NutriClinicaDocument> => {
    const document = await voidDocumentUC(repository, id, reason);
    await recordClinicalAudit({ module: "documents", action: "update", resourceType: "document", resourceId: document.id.toString(), patientId: document.patientId ?? null, justification: "void" });
    return document;
  },
};

export type DocumentService = typeof documentService;

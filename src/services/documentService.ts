import { db } from "@services/db/dexieSchema";
import { DexieDocumentRepository } from "@modules/documents/infrastructure/DexieDocumentRepository";
import {
  createDocumentUC, listDocumentsUC, getDocumentByIdUC,
  deleteDocumentUC, signDocumentUC, deliverDocumentUC, voidDocumentUC,
} from "@modules/documents/application/documentUseCases";
import type { DocumentId } from "@modules/documents/domain/DocumentId";
import type { NutriClinicaDocument } from "@modules/documents/domain/NutriClinicaDocument";
import type { DocumentFormInput } from "@modules/documents/application/documentFormSchema";

const repository = new DexieDocumentRepository(db);

export const documentService = {
  create: (input: DocumentFormInput, generatedBy: string): Promise<NutriClinicaDocument> =>
    createDocumentUC(repository, input, generatedBy),
  list: (): Promise<NutriClinicaDocument[]> => listDocumentsUC(repository),
  getById: (id: DocumentId): Promise<NutriClinicaDocument | null> => getDocumentByIdUC(repository, id),
  delete: (id: DocumentId): Promise<void> => deleteDocumentUC(repository, id),
  sign: (id: DocumentId, signedBy: string, hash: string): Promise<NutriClinicaDocument> =>
    signDocumentUC(repository, id, signedBy, hash),
  deliver: (id: DocumentId): Promise<NutriClinicaDocument> => deliverDocumentUC(repository, id),
  void: (id: DocumentId, reason: string): Promise<NutriClinicaDocument> => voidDocumentUC(repository, id, reason),
};

export type DocumentService = typeof documentService;

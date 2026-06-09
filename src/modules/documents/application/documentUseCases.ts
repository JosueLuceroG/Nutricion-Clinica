import { NutriClinicaDocument } from "../domain/NutriClinicaDocument";
import { createDocumentId, type DocumentId } from "../domain/DocumentId";
import type { DocumentRepository } from "../domain/DocumentRepository";
import type { DocumentFormInput } from "./documentFormSchema";

export const createDocumentUC = async (
  repo: DocumentRepository,
  input: DocumentFormInput,
  generatedBy: string,
): Promise<NutriClinicaDocument> => {
  const doc = NutriClinicaDocument.create({
    id: createDocumentId(),
    patientId: input.patientId,
    consultationId: input.consultationId,
    type: input.type,
    title: input.title,
    contentHtml: input.contentHtml,
    parameters: input.parameters,
    generatedBy,
  });
  await repo.save(doc);
  return doc;
};

export const listDocumentsUC = async (repo: DocumentRepository): Promise<NutriClinicaDocument[]> => {
  return repo.findAll();
};

export const getDocumentByIdUC = async (repo: DocumentRepository, id: DocumentId): Promise<NutriClinicaDocument | null> => {
  return repo.findById(id);
};

export const deleteDocumentUC = async (repo: DocumentRepository, id: DocumentId): Promise<void> => {
  await repo.delete(id);
};

export const signDocumentUC = async (
  repo: DocumentRepository,
  id: DocumentId,
  signedBy: string,
  signatureHash: string,
): Promise<NutriClinicaDocument> => {
  const existing = await repo.findById(id);
  if (!existing) throw new Error(`Documento no encontrado: ${id}`);
  const signed = existing.sign(signedBy, signatureHash);
  await repo.save(signed);
  return signed;
};

export const deliverDocumentUC = async (repo: DocumentRepository, id: DocumentId): Promise<NutriClinicaDocument> => {
  const existing = await repo.findById(id);
  if (!existing) throw new Error(`Documento no encontrado: ${id}`);
  const delivered = existing.deliver();
  await repo.save(delivered);
  return delivered;
};

export const voidDocumentUC = async (repo: DocumentRepository, id: DocumentId, reason: string): Promise<NutriClinicaDocument> => {
  const existing = await repo.findById(id);
  if (!existing) throw new Error(`Documento no encontrado: ${id}`);
  const voided = existing.void(reason);
  await repo.save(voided);
  return voided;
};

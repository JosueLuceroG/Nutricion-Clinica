import type { NutriClinicaDocument, DocumentProps } from "./NutriClinicaDocument";
import type { DocumentId } from "./DocumentId";
import type { DocumentType } from "./DocumentTypes";

export interface DocumentRepository {
  save(doc: NutriClinicaDocument): Promise<void>;
  findById(id: DocumentId): Promise<NutriClinicaDocument | null>;
  findByPatient(patientId: string): Promise<NutriClinicaDocument[]>;
  findByType(type: DocumentType): Promise<NutriClinicaDocument[]>;
  findAll(): Promise<NutriClinicaDocument[]>;
  delete(id: DocumentId): Promise<void>;
}

export class DocumentNotFoundError extends Error {
  constructor(public readonly id: DocumentId) {
    super(`Documento no encontrado: ${id}`);
    this.name = "DocumentNotFoundError";
  }
}

export type { NutriClinicaDocument, DocumentProps, DocumentId };

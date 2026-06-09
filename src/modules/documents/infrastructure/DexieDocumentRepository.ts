import type { NutriClinicaDocument } from "../domain/NutriClinicaDocument";
import type { DocumentId } from "../domain/DocumentId";
import type { DocumentRepository } from "../domain/DocumentRepository";
import type { DocumentType } from "../domain/DocumentTypes";
import { documentToRow, rowToDocument } from "./documentMapper";
import type { NutriClinicaDB } from "@services/db/dexieSchema";

export class DexieDocumentRepository implements DocumentRepository {
  constructor(private readonly db: NutriClinicaDB) {}

  async save(doc: NutriClinicaDocument): Promise<void> {
    await this.db.documents.put(documentToRow(doc));
  }

  async findById(id: DocumentId): Promise<NutriClinicaDocument | null> {
    const row = await this.db.documents.get(id);
    return row ? rowToDocument(row) : null;
  }

  async findByPatient(patientId: string): Promise<NutriClinicaDocument[]> {
    const rows = await this.db.documents.where("patient_id").equals(patientId).toArray();
    return rows.map(rowToDocument);
  }

  async findByType(type: DocumentType): Promise<NutriClinicaDocument[]> {
    const rows = await this.db.documents.where("type").equals(type).toArray();
    return rows.map(rowToDocument);
  }

  async findAll(): Promise<NutriClinicaDocument[]> {
    const rows = await this.db.documents.toArray();
    return rows.map(rowToDocument);
  }

  async delete(id: DocumentId): Promise<void> {
    await this.db.documents.delete(id);
  }
}

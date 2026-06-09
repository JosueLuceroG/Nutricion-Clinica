import { NutriClinicaDocument, type DocumentProps } from "../domain/NutriClinicaDocument";
import type { DocumentId } from "../domain/DocumentId";

export interface DocumentRow {
  id: string;
  patient_id: string | null;
  consultation_id: string | null;
  type: string;
  title: string;
  content_html: string;
  parameters: string;
  status: string;
  generated_by: string;
  generated_at: number;
  signed_at: number | null;
  signed_by: string | null;
  signature_hash: string | null;
  void_reason: string;
  version: number;
  created_at: number;
  updated_at: number;
}

export function documentToRow(doc: NutriClinicaDocument): DocumentRow {
  const p = doc.toProps();
  return {
    id: p.id,
    patient_id: p.patientId ?? null,
    consultation_id: p.consultationId ?? null,
    type: p.type,
    title: p.title,
    content_html: p.contentHtml,
    parameters: p.parameters,
    status: p.status,
    generated_by: p.generatedBy,
    generated_at: p.generatedAt,
    signed_at: p.signedAt ?? null,
    signed_by: p.signedBy ?? null,
    signature_hash: p.signatureHash ?? null,
    void_reason: p.voidReason,
    version: p.version,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function rowToDocument(row: DocumentRow): NutriClinicaDocument {
  return NutriClinicaDocument.reconstitute({
    id: row.id as DocumentId,
    patientId: row.patient_id ?? undefined,
    consultationId: row.consultation_id ?? undefined,
    type: row.type as DocumentProps["type"],
    title: row.title,
    contentHtml: row.content_html,
    parameters: row.parameters,
    status: row.status as DocumentProps["status"],
    generatedBy: row.generated_by,
    generatedAt: row.generated_at,
    signedAt: row.signed_at ?? undefined,
    signedBy: row.signed_by ?? undefined,
    signatureHash: row.signature_hash ?? undefined,
    voidReason: row.void_reason,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

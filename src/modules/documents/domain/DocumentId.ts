import { z } from "zod";

export const DocumentIdSchema = z.string().uuid();
export type DocumentId = z.infer<typeof DocumentIdSchema> & { __brand: "DocumentId" };

export function createDocumentId(): DocumentId {
  return crypto.randomUUID() as DocumentId;
}
export function documentIdFrom(value: string): DocumentId {
  return DocumentIdSchema.parse(value) as DocumentId;
}
export function documentIdFromUnsafe(value: string): DocumentId {
  return value as DocumentId;
}

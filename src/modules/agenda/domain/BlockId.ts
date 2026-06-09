import { z } from "zod";

export const BlockIdSchema = z.string().uuid();

export type BlockId = z.infer<typeof BlockIdSchema> & { __brand: "BlockId" };

export function createBlockId(): BlockId {
  return crypto.randomUUID() as BlockId;
}

export function blockIdFrom(value: string): BlockId {
  return BlockIdSchema.parse(value) as BlockId;
}

export function blockIdFromUnsafe(value: string): BlockId {
  return value as BlockId;
}

import { z } from "zod";

export const ClinicalEventIdSchema = z.string().min(1, "ID de evento clínico requerido");
const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ClinicalEventId {
  private constructor(public readonly value: string) {}

  static generate(): ClinicalEventId {
    return new ClinicalEventId(crypto.randomUUID());
  }

  static from(value: string): ClinicalEventId {
    if (!UUID_V7_REGEX.test(value)) {
      throw new Error(`ClinicalEventId inválido: ${value}. Debe ser UUIDv7.`);
    }
    return new ClinicalEventId(value);
  }

  static fromUnsafe(s: string): ClinicalEventId {
    return new ClinicalEventId(s);
  }

  toString(): string {
    return this.value;
  }

  equals(other: ClinicalEventId): boolean {
    return this.value === other.value;
  }
}

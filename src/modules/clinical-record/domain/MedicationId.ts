import { z } from "zod";

export const MedicationIdSchema = z.string().min(1, "ID de medicamento requerido");
const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class MedicationId {
  private constructor(public readonly value: string) {}

  static generate(): MedicationId {
    return new MedicationId(crypto.randomUUID());
  }

  static from(value: string): MedicationId {
    if (!UUID_V7_REGEX.test(value)) {
      throw new Error(`MedicationId inválido: ${value}. Debe ser UUIDv7.`);
    }
    return new MedicationId(value);
  }

  static fromUnsafe(s: string): MedicationId {
    return new MedicationId(s);
  }

  toString(): string {
    return this.value;
  }

  equals(other: MedicationId): boolean {
    return this.value === other.value;
  }
}

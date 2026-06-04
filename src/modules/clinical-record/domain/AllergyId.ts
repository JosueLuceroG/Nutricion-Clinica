import { z } from "zod";

export const AllergyIdSchema = z.string().min(1, "ID de alergia requerido");
const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AllergyId {
  private constructor(public readonly value: string) {}

  static generate(): AllergyId {
    return new AllergyId(crypto.randomUUID());
  }

  static from(value: string): AllergyId {
    if (!UUID_V7_REGEX.test(value)) {
      throw new Error(`AllergyId inválido: ${value}. Debe ser UUIDv7.`);
    }
    return new AllergyId(value);
  }

  static fromUnsafe(s: string): AllergyId {
    return new AllergyId(s);
  }

  toString(): string {
    return this.value;
  }

  equals(other: AllergyId): boolean {
    return this.value === other.value;
  }
}

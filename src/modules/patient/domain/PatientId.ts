/**
 * Branded ID para Patient. Garantiza type-safety a nivel de compilación.
 * Usa UUIDv7 (ordenable por tiempo). Validación en construcción.
 */
export class PatientId {
  private static readonly UUID_V7_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private constructor(public readonly value: string) {}

  static generate(): PatientId {
    return new PatientId(crypto.randomUUID());
  }

  static from(value: string): PatientId {
    if (!PatientId.UUID_V7_REGEX.test(value)) {
      throw new Error(`PatientId inválido: ${value}. Debe ser UUIDv7.`);
    }
    return new PatientId(value);
  }

  static fromUnsafe(value: string): PatientId {
    return new PatientId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: PatientId): boolean {
    return this.value === other.value;
  }
}

export type PatientIdString = string & { readonly __brand: "PatientId" };

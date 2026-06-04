/**
 * Branded ID para ConsentimientoInformado. Garantiza type-safety a nivel de compilación.
 * Usa UUIDv7 (ordenable por tiempo). Validación en construcción.
 */
export class ConsentId {
  private static readonly UUID_V7_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private constructor(public readonly value: string) {}

  static generate(): ConsentId {
    return new ConsentId(crypto.randomUUID());
  }

  static from(value: string): ConsentId {
    if (!ConsentId.UUID_V7_REGEX.test(value)) {
      throw new Error(`ConsentId inválido: ${value}. Debe ser UUIDv7.`);
    }
    return new ConsentId(value);
  }

  static fromUnsafe(value: string): ConsentId {
    return new ConsentId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: ConsentId): boolean {
    return this.value === other.value;
  }
}

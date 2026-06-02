/**
 * Branded ID para mediciones antropométricas. UUIDv7 (ordenable por tiempo).
 */
export class AnthropometryId {
  private static readonly UUID_V7_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private constructor(public readonly value: string) {}

  static generate(): AnthropometryId {
    return new AnthropometryId(crypto.randomUUID());
  }

  static from(value: string): AnthropometryId {
    if (!AnthropometryId.UUID_V7_REGEX.test(value)) {
      throw new Error(`AnthropometryId inválido: ${value}. Debe ser UUIDv7.`);
    }
    return new AnthropometryId(value);
  }

  static fromUnsafe(value: string): AnthropometryId {
    return new AnthropometryId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: AnthropometryId): boolean {
    return this.value === other.value;
  }
}

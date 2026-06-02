/**
 * Branded ID para consultas. UUIDv7 (ordenable por tiempo).
 */
export class ConsultationId {
  private static readonly UUID_V7_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private constructor(public readonly value: string) {}

  static generate(): ConsultationId {
    return new ConsultationId(crypto.randomUUID());
  }

  static from(value: string): ConsultationId {
    if (!ConsultationId.UUID_V7_REGEX.test(value)) {
      throw new Error(`ConsultationId inválido: ${value}. Debe ser UUIDv7.`);
    }
    return new ConsultationId(value);
  }

  static fromUnsafe(value: string): ConsultationId {
    return new ConsultationId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: ConsultationId): boolean {
    return this.value === other.value;
  }
}

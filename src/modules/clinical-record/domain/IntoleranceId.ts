const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class IntoleranceId {
  private constructor(public readonly value: string) {}

  static generate(): IntoleranceId {
    return new IntoleranceId(crypto.randomUUID());
  }

  static from(value: string): IntoleranceId {
    if (!UUID_V7_REGEX.test(value)) {
      throw new Error(`IntoleranceId inválido: ${value}. Debe ser UUIDv7.`);
    }
    return new IntoleranceId(value);
  }

  static fromUnsafe(s: string): IntoleranceId {
    return new IntoleranceId(s);
  }

  toString(): string {
    return this.value;
  }

  equals(other: IntoleranceId): boolean {
    return this.value === other.value;
  }
}

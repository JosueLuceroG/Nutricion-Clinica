const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class DietHistoryId {
  private constructor(public readonly value: string) {}

  static generate(): DietHistoryId {
    return new DietHistoryId(crypto.randomUUID());
  }

  static from(value: string): DietHistoryId {
    if (!UUID_V7_REGEX.test(value)) {
      throw new Error(`DietHistoryId inválido: ${value}. Debe ser UUIDv7.`);
    }
    return new DietHistoryId(value);
  }

  static fromUnsafe(s: string): DietHistoryId {
    return new DietHistoryId(s);
  }

  toString(): string {
    return this.value;
  }

  equals(other: DietHistoryId): boolean {
    return this.value === other.value;
  }
}

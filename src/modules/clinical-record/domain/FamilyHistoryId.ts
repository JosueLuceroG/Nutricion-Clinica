const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class FamilyHistoryId {
  private constructor(public readonly value: string) {}

  static generate(): FamilyHistoryId {
    return new FamilyHistoryId(crypto.randomUUID());
  }

  static from(value: string): FamilyHistoryId {
    if (!UUID_V7_REGEX.test(value)) {
      throw new Error(`FamilyHistoryId inválido: ${value}. Debe ser UUIDv7.`);
    }
    return new FamilyHistoryId(value);
  }

  static fromUnsafe(s: string): FamilyHistoryId {
    return new FamilyHistoryId(s);
  }

  toString(): string {
    return this.value;
  }

  equals(other: FamilyHistoryId): boolean {
    return this.value === other.value;
  }
}

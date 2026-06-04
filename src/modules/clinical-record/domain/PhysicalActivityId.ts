const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class PhysicalActivityId {
  private constructor(public readonly value: string) {}

  static generate(): PhysicalActivityId {
    return new PhysicalActivityId(crypto.randomUUID());
  }

  static from(value: string): PhysicalActivityId {
    if (!UUID_V7_REGEX.test(value)) {
      throw new Error(`PhysicalActivityId inválido: ${value}. Debe ser UUIDv7.`);
    }
    return new PhysicalActivityId(value);
  }

  static fromUnsafe(s: string): PhysicalActivityId {
    return new PhysicalActivityId(s);
  }

  toString(): string {
    return this.value;
  }

  equals(other: PhysicalActivityId): boolean {
    return this.value === other.value;
  }
}

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class HabitId {
  private constructor(public readonly value: string) {}

  static generate(): HabitId {
    return new HabitId(crypto.randomUUID());
  }

  static from(value: string): HabitId {
    if (!UUID_V7_REGEX.test(value)) {
      throw new Error(`HabitId inválido: ${value}. Debe ser UUIDv7.`);
    }
    return new HabitId(value);
  }

  static fromUnsafe(s: string): HabitId {
    return new HabitId(s);
  }

  toString(): string {
    return this.value;
  }

  equals(other: HabitId): boolean {
    return this.value === other.value;
  }
}

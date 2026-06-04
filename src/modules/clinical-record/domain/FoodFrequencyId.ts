const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class FoodFrequencyId {
  private constructor(public readonly value: string) {}
  static generate(): FoodFrequencyId { return new FoodFrequencyId(crypto.randomUUID()); }
  static from(value: string): FoodFrequencyId { if (!UUID_V7_REGEX.test(value)) throw new Error("FoodFrequencyId inválido"); return new FoodFrequencyId(value); }
  static fromUnsafe(s: string): FoodFrequencyId { return new FoodFrequencyId(s); }
  toString(): string { return this.value; }
  equals(other: FoodFrequencyId): boolean { return this.value === other.value; }
}

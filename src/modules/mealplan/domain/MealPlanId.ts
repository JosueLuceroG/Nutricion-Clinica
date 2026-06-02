/**
 * Branded ID para planes alimentarios. UUIDv7 (ordenable por tiempo).
 */
export class MealPlanId {
  private static readonly UUID_V7_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private constructor(public readonly value: string) {}

  static generate(): MealPlanId {
    return new MealPlanId(crypto.randomUUID());
  }

  static from(value: string): MealPlanId {
    if (!MealPlanId.UUID_V7_REGEX.test(value)) {
      throw new Error(`MealPlanId inválido: ${value}. Debe ser UUIDv7.`);
    }
    return new MealPlanId(value);
  }

  static fromUnsafe(value: string): MealPlanId {
    return new MealPlanId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: MealPlanId): boolean {
    return this.value === other.value;
  }
}

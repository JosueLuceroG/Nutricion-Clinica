const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class GiSymptomId {
  private constructor(public readonly value: string) {}
  static generate(): GiSymptomId { return new GiSymptomId(crypto.randomUUID()); }
  static from(value: string): GiSymptomId { if (!UUID_V7_REGEX.test(value)) throw new Error("GiSymptomId inválido"); return new GiSymptomId(value); }
  static fromUnsafe(s: string): GiSymptomId { return new GiSymptomId(s); }
  toString(): string { return this.value; }
  equals(other: GiSymptomId): boolean { return this.value === other.value; }
}

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class HospitalizationId {
  private constructor(public readonly value: string) {}
  static generate(): HospitalizationId { return new HospitalizationId(crypto.randomUUID()); }
  static from(value: string): HospitalizationId { if (!UUID_V7_REGEX.test(value)) throw new Error("HospitalizationId inválido"); return new HospitalizationId(value); }
  static fromUnsafe(s: string): HospitalizationId { return new HospitalizationId(s); }
  toString(): string { return this.value; }
  equals(other: HospitalizationId): boolean { return this.value === other.value; }
}

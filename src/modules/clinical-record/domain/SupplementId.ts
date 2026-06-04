const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class SupplementId {
  private constructor(public readonly value: string) {}
  static generate(): SupplementId { return new SupplementId(crypto.randomUUID()); }
  static from(value: string): SupplementId { if (!UUID_V7_REGEX.test(value)) throw new Error("SupplementId inválido"); return new SupplementId(value); }
  static fromUnsafe(s: string): SupplementId { return new SupplementId(s); }
  toString(): string { return this.value; }
  equals(other: SupplementId): boolean { return this.value === other.value; }
}

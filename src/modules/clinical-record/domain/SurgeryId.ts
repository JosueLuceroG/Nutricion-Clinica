const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class SurgeryId {
  private constructor(public readonly value: string) {}
  static generate(): SurgeryId { return new SurgeryId(crypto.randomUUID()); }
  static from(value: string): SurgeryId { if (!UUID_V7_REGEX.test(value)) throw new Error("SurgeryId inválido"); return new SurgeryId(value); }
  static fromUnsafe(s: string): SurgeryId { return new SurgeryId(s); }
  toString(): string { return this.value; }
  equals(other: SurgeryId): boolean { return this.value === other.value; }
}

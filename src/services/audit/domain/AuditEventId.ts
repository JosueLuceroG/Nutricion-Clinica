export class AuditEventId {
  private constructor(public readonly value: string) {}
  static generate(): AuditEventId { return new AuditEventId(crypto.randomUUID()); }
  static from(value: string): AuditEventId { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error("AuditEventId inválido"); return new AuditEventId(value); }
  static fromUnsafe(s: string): AuditEventId { return new AuditEventId(s); }
  toString(): string { return this.value; }
  equals(other: AuditEventId): boolean { return this.value === other.value; }
}

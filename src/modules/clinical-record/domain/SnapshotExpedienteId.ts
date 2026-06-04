export class SnapshotExpedienteId {
  private constructor(public readonly value: string) {}
  static generate(): SnapshotExpedienteId { return new SnapshotExpedienteId(crypto.randomUUID()); }
  static from(value: string): SnapshotExpedienteId { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error("SnapshotExpedienteId inválido"); return new SnapshotExpedienteId(value); }
  static fromUnsafe(s: string): SnapshotExpedienteId { return new SnapshotExpedienteId(s); }
  toString(): string { return this.value; }
  equals(other: SnapshotExpedienteId): boolean { return this.value === other.value; }
}

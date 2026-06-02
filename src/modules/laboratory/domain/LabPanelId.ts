/**
 * Branded ID para paneles de laboratorio. UUIDv7 (ordenable por tiempo).
 */
export class LabPanelId {
  private static readonly UUID_V7_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private constructor(public readonly value: string) {}

  static generate(): LabPanelId {
    return new LabPanelId(crypto.randomUUID());
  }

  static from(value: string): LabPanelId {
    if (!LabPanelId.UUID_V7_REGEX.test(value)) {
      throw new Error(`LabPanelId inválido: ${value}. Debe ser UUIDv7.`);
    }
    return new LabPanelId(value);
  }

  static fromUnsafe(value: string): LabPanelId {
    return new LabPanelId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: LabPanelId): boolean {
    return this.value === other.value;
  }
}

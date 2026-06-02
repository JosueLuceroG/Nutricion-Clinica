/**
 * Signos vitales capturados en consulta. Value object inmutable.
 *
 * Cualquier campo puede ser null si no se tomó esa medición en la consulta.
 * Los rangos siguen estándares clínicos generales (mmHg, lpm, °C).
 */
export class Vitals {
  private constructor(
    public readonly systolicMmHg: number | null,
    public readonly diastolicMmHg: number | null,
    public readonly heartRateBpm: number | null,
    public readonly temperatureC: number | null,
  ) {}

  static from(input: {
    systolicMmHg?: number | null;
    diastolicMmHg?: number | null;
    heartRateBpm?: number | null;
    temperatureC?: number | null;
  }): Vitals {
    const sys = Vitals.normalizeInt(input.systolicMmHg, 50, 260, "Tensión sistólica");
    const dia = Vitals.normalizeInt(input.diastolicMmHg, 30, 180, "Tensión diastólica");
    const hr = Vitals.normalizeInt(input.heartRateBpm, 20, 220, "Frecuencia cardíaca");
    const t = Vitals.normalizeFloat(input.temperatureC, 30, 45, "Temperatura");
    return new Vitals(sys, dia, hr, t);
  }

  static empty(): Vitals {
    return new Vitals(null, null, null, null);
  }

  get isEmpty(): boolean {
    return (
      this.systolicMmHg === null &&
      this.diastolicMmHg === null &&
      this.heartRateBpm === null &&
      this.temperatureC === null
    );
  }

  toJSON(): {
    systolicMmHg: number | null;
    diastolicMmHg: number | null;
    heartRateBpm: number | null;
    temperatureC: number | null;
  } {
    return {
      systolicMmHg: this.systolicMmHg,
      diastolicMmHg: this.diastolicMmHg,
      heartRateBpm: this.heartRateBpm,
      temperatureC: this.temperatureC,
    };
  }

  static fromJSON(json: unknown): Vitals {
    if (!json || typeof json !== "object") return Vitals.empty();
    const o = json as Record<string, unknown>;
    return Vitals.from({
      systolicMmHg: Vitals.toNumOrNull(o.systolicMmHg),
      diastolicMmHg: Vitals.toNumOrNull(o.diastolicMmHg),
      heartRateBpm: Vitals.toNumOrNull(o.heartRateBpm),
      temperatureC: Vitals.toNumOrNull(o.temperatureC),
    });
  }

  private static toNumOrNull(v: unknown): number | null {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return null;
  }

  private static normalizeInt(
    v: number | null | undefined,
    min: number,
    max: number,
    field: string,
  ): number | null {
    if (v === null || v === undefined) return null;
    if (!Number.isFinite(v)) return null;
    const n = Math.round(v);
    if (n < min || n > max) {
      throw new Error(`${field} fuera de rango (${min}–${max}).`);
    }
    return n;
  }

  private static normalizeFloat(
    v: number | null | undefined,
    min: number,
    max: number,
    field: string,
  ): number | null {
    if (v === null || v === undefined) return null;
    if (!Number.isFinite(v)) return null;
    const n = Math.round(v * 10) / 10;
    if (n < min || n > max) {
      throw new Error(`${field} fuera de rango (${min}–${max}).`);
    }
    return n;
  }
}

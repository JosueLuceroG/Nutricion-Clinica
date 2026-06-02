import type { LabTestCode } from "./LabTest";

/**
 * Tipos de bandera para un valor de laboratorio.
 *  - normal: dentro del rango de referencia
 *  - low: por debajo del límite inferior
 *  - high: por encima del límite superior
 *  - critical-low / critical-high: requiere atención clínica urgente
 */
export type LabFlag = "normal" | "low" | "high" | "critical-low" | "critical-high";

export const LabFlagLabel: Record<LabFlag, string> = {
  normal: "Normal",
  low: "Bajo",
  high: "Alto",
  "critical-low": "Crítico bajo",
  "critical-high": "Crítico alto",
};

export const LabFlagColor: Record<LabFlag, "success" | "warning" | "destructive" | "info"> = {
  normal: "success",
  low: "warning",
  high: "warning",
  "critical-low": "destructive",
  "critical-high": "destructive",
};

import type { LabReferenceRange } from "./LabReferenceRange";

/**
 * Clasifica un valor numérico contra un rango de referencia.
 * Si no hay rango, retorna 'normal' (no se puede evaluar).
 */
export const classifyLabValue = (value: number, range: LabReferenceRange | null): LabFlag => {
  if (!range) return "normal";
  const { low, high, criticalLow, criticalHigh } = range;
  if (criticalLow !== null && criticalLow !== undefined && value <= criticalLow) return "critical-low";
  if (criticalHigh !== null && criticalHigh !== undefined && value >= criticalHigh) return "critical-high";
  if (low !== null && value < low) return "low";
  if (high !== null && value > high) return "high";
  return "normal";
};

export interface LabResultInput {
  test: LabTestCode;
  value: number;
}

/**
 * Resultado de laboratorio de un solo parámetro.
 * Inmutable.
 */
export class LabResult {
  private constructor(
    public readonly test: LabTestCode,
    public readonly value: number,
  ) {}

  static from(input: LabResultInput): LabResult {
    if (!Number.isFinite(input.value)) {
      throw new RangeError(`Valor para ${input.test} inválido.`);
    }
    return new LabResult(input.test, input.value);
  }
}

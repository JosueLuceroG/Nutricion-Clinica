import { z } from "zod";
import type { LabTestCode } from "./LabTest";
import { getLabTestDefinition } from "./LabTest";

/**
 * Rango de referencia para una prueba.
 * Si `low`/`high` son null, no se acota en ese extremo.
 * Los rangos son orientativos para población adulta mexicana en ayuno.
 * Las banderas críticas son opcionales (azul-rojo para alerta clínica).
 */
export const LabReferenceRangeSchema = z.object({
  test: z.string(),
  sex: z.enum(["all", "male", "female"]),
  ageMinYears: z.number().int().nonnegative().optional(),
  ageMaxYears: z.number().int().positive().optional(),
  low: z.number().nullable(),
  high: z.number().nullable(),
  criticalLow: z.number().nullable().optional(),
  criticalHigh: z.number().nullable().optional(),
  notes: z.string().optional(),
});

export type LabReferenceRange = z.infer<typeof LabReferenceRangeSchema>;

import type { Sex } from "@modules/patient/domain/Sex";

const sexKey = (sex: Sex): "all" | "male" | "female" => {
  if (sex === "male") return "male";
  if (sex === "female") return "female";
  return "all";
};

const inAgeRange = (range: LabReferenceRange, ageYears: number): boolean => {
  if (range.ageMinYears !== undefined && ageYears < range.ageMinYears) return false;
  if (range.ageMaxYears !== undefined && ageYears >= range.ageMaxYears) return false;
  return true;
};

export const findReferenceRange = (
  test: LabTestCode,
  sex: Sex,
  ageYears: number,
  ranges: LabReferenceRange[],
): LabReferenceRange | null => {
  const sexKeyValue = sexKey(sex);
  const candidates = ranges.filter(
    (r) => r.test === test && (r.sex === sexKeyValue || r.sex === "all") && inAgeRange(r, ageYears),
  );
  if (candidates.length === 0) return null;
  const exact = candidates.find((r) => r.sex === sexKeyValue);
  return exact ?? candidates[0] ?? null;
};

/**
 * Valor de laboratorio con su unidad.
 * La validación se hace contra la definición del test.
 */
export class LabValue {
  private constructor(
    public readonly numericValue: number,
    public readonly definition: ReturnType<typeof getLabTestDefinition>,
  ) {}

  static from(code: LabTestCode, raw: number): LabValue {
    const def = getLabTestDefinition(code);
    if (!Number.isFinite(raw)) {
      throw new RangeError(`Valor de ${def.name} inválido.`);
    }
    return new LabValue(raw, def);
  }

  formatted(): string {
    return this.numericValue.toFixed(this.definition.decimals);
  }

  unit(): string {
    return this.definition.unit;
  }
}

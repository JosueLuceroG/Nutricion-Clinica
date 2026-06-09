import { z } from "zod";
import { AdherenceTendencySchema, type AdherenceTendency } from "./AdherenceTypes";
import type { AdherenceRecord } from "./AdherenceRecord";

export const AdherenceIndexSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scoreMenu: z.number().min(0).max(100),
  scoreWater: z.number().min(0).max(100),
  scoreActivity: z.number().min(0).max(100),
  scoreSupplements: z.number().min(0).max(100),
  scoreSleep: z.number().min(0).max(100),
  scoreGlobal: z.number().min(0).max(100),
  tendency: AdherenceTendencySchema,
  calculatedAt: z.number().int().positive(),
});
export type AdherenceIndexProps = z.infer<typeof AdherenceIndexSchema>;

export class AdherenceIndex {
  private constructor(private readonly props: AdherenceIndexProps) {}

  get id(): string { return this.props.id; }
  get patientId(): string { return this.props.patientId; }
  get periodStart(): string { return this.props.periodStart; }
  get periodEnd(): string { return this.props.periodEnd; }
  get scoreMenu(): number { return this.props.scoreMenu; }
  get scoreWater(): number { return this.props.scoreWater; }
  get scoreActivity(): number { return this.props.scoreActivity; }
  get scoreSupplements(): number { return this.props.scoreSupplements; }
  get scoreSleep(): number { return this.props.scoreSleep; }
  get scoreGlobal(): number { return this.props.scoreGlobal; }
  get tendency(): AdherenceTendency { return this.props.tendency; }
  get calculatedAt(): number { return this.props.calculatedAt; }

  toProps(): AdherenceIndexProps { return { ...this.props }; }

  static create(props: Omit<AdherenceIndexProps, "id" | "calculatedAt">): AdherenceIndex {
    return new AdherenceIndex({
      ...props,
      id: crypto.randomUUID(),
      calculatedAt: Date.now(),
    });
  }

  static reconstitute(props: AdherenceIndexProps): AdherenceIndex {
    return new AdherenceIndex(props);
  }
}

export function calculateAdherenceIndex(records: AdherenceRecord[]): Omit<AdherenceIndexProps, "id" | "patientId" | "periodStart" | "periodEnd" | "calculatedAt"> {
  if (records.length === 0) {
    return { scoreMenu: 0, scoreWater: 0, scoreActivity: 0, scoreSupplements: 0, scoreSleep: 0, scoreGlobal: 0, tendency: "estable" };
  }

  const avg = (fn: (r: AdherenceRecord) => number) =>
    Math.round(records.reduce((s, r) => s + fn(r), 0) / records.length);

  const scoreMenu = avg((r) => r.adherenceMenu);
  const scoreWater = avg((r) => r.adherenceWater);
  const scoreActivity = avg((r) => r.adherenceActivity);
  const scoreSupplements = avg((r) => r.adherenceSupplements);
  const scoreSleep = avg((r) => r.adherenceSleep);
  const scoreGlobal = Math.round((scoreMenu * 0.3 + scoreWater * 0.2 + scoreActivity * 0.2 + scoreSupplements * 0.15 + scoreSleep * 0.15));

  return { scoreMenu, scoreWater, scoreActivity, scoreSupplements, scoreSleep, scoreGlobal, tendency: "estable" };
}

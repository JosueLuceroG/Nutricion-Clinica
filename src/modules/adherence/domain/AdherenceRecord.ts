import { z } from "zod";
import { AdherenceIdSchema, type AdherenceId } from "./AdherenceId";
import { AdherenceSourceSchema, type AdherenceSource } from "./AdherenceTypes";

export const AdherenceRecordSchema = z.object({
  id: AdherenceIdSchema,
  patientId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  consultationId: z.string().uuid().optional(),
  source: AdherenceSourceSchema,
  adherenceMenu: z.number().min(0).max(100).default(0),
  adherenceWater: z.number().min(0).max(100).default(0),
  adherenceActivity: z.number().min(0).max(100).default(0),
  adherenceSupplements: z.number().min(0).max(100).default(0),
  adherenceSleep: z.number().min(0).max(100).default(0),
  hungerAvg: z.number().min(1).max(10).optional(),
  satietyAvg: z.number().min(1).max(10).optional(),
  moodAvg: z.number().min(1).max(10).optional(),
  energyAvg: z.number().min(1).max(10).optional(),
  intercurrentEvents: z.string().max(1000).default(""),
  barriers: z.string().max(1000).default(""),
  facilitators: z.string().max(1000).default(""),
  mealsLogged: z.string().max(2000).default(""),
  notes: z.string().max(2000).default(""),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});
export type AdherenceRecordProps = z.infer<typeof AdherenceRecordSchema>;

export class AdherenceRecord {
  private constructor(private readonly props: AdherenceRecordProps) {}

  get id(): AdherenceId { return this.props.id as AdherenceId; }
  get patientId(): string { return this.props.patientId; }
  get date(): string { return this.props.date; }
  get consultationId(): string | undefined { return this.props.consultationId; }
  get source(): AdherenceSource { return this.props.source; }
  get adherenceMenu(): number { return this.props.adherenceMenu; }
  get adherenceWater(): number { return this.props.adherenceWater; }
  get adherenceActivity(): number { return this.props.adherenceActivity; }
  get adherenceSupplements(): number { return this.props.adherenceSupplements; }
  get adherenceSleep(): number { return this.props.adherenceSleep; }
  get hungerAvg(): number | undefined { return this.props.hungerAvg; }
  get satietyAvg(): number | undefined { return this.props.satietyAvg; }
  get moodAvg(): number | undefined { return this.props.moodAvg; }
  get energyAvg(): number | undefined { return this.props.energyAvg; }
  get intercurrentEvents(): string { return this.props.intercurrentEvents; }
  get barriers(): string { return this.props.barriers; }
  get facilitators(): string { return this.props.facilitators; }
  get mealsLogged(): string { return this.props.mealsLogged; }
  get notes(): string { return this.props.notes; }
  get createdAt(): number { return this.props.createdAt; }
  get updatedAt(): number { return this.props.updatedAt; }

  toProps(): AdherenceRecordProps {
    return { ...this.props };
  }

  static create(props: Omit<AdherenceRecordProps, "createdAt" | "updatedAt">): AdherenceRecord {
    return new AdherenceRecord({
      ...props,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  static reconstitute(props: AdherenceRecordProps): AdherenceRecord {
    return new AdherenceRecord(props);
  }

  with(updates: Partial<AdherenceRecordProps>): AdherenceRecord {
    return AdherenceRecord.reconstitute({ ...this.props, ...updates, updatedAt: Date.now() });
  }
}

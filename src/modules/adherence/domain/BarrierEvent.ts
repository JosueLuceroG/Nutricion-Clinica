import { z } from "zod";
import { BarrierTypeSchema, type BarrierType } from "./AdherenceTypes";

export const BarrierEventSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  type: BarrierTypeSchema,
  description: z.string().min(1).max(1000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  resolutionDate: z.string().optional(),
  actionTaken: z.string().max(1000).default(""),
  createdAt: z.number().int().positive(),
});
export type BarrierEventProps = z.infer<typeof BarrierEventSchema>;

export class BarrierEvent {
  private constructor(private readonly props: BarrierEventProps) {}

  get id(): string { return this.props.id; }
  get patientId(): string { return this.props.patientId; }
  get type(): BarrierType { return this.props.type; }
  get description(): string { return this.props.description; }
  get date(): string { return this.props.date; }
  get resolutionDate(): string | undefined { return this.props.resolutionDate; }
  get actionTaken(): string { return this.props.actionTaken; }
  get createdAt(): number { return this.props.createdAt; }

  toProps(): BarrierEventProps { return { ...this.props }; }

  static create(props: Omit<BarrierEventProps, "id" | "createdAt">): BarrierEvent {
    return new BarrierEvent({
      ...props,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    });
  }

  static reconstitute(props: BarrierEventProps): BarrierEvent {
    return new BarrierEvent(props);
  }
}

import { z } from "zod";
import { BlockIdSchema, type BlockId } from "./BlockId";

export const BlockSchema = z.object({
  id: BlockIdSchema,
  professionalId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM").optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM").optional(),
  allDay: z.boolean().default(true),
  reason: z.string().max(500).default(""),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});

export type BlockProps = z.infer<typeof BlockSchema>;

export class Block {
  private constructor(private readonly props: BlockProps) {}

  get id(): BlockId { return this.props.id as BlockId; }
  get professionalId(): string { return this.props.professionalId; }
  get startDate(): string { return this.props.startDate; }
  get endDate(): string { return this.props.endDate; }
  get startTime(): string | undefined { return this.props.startTime; }
  get endTime(): string | undefined { return this.props.endTime; }
  get allDay(): boolean { return this.props.allDay; }
  get reason(): string { return this.props.reason; }
  get createdAt(): number { return this.props.createdAt; }
  get updatedAt(): number { return this.props.updatedAt; }

  toProps(): BlockProps { return { ...this.props }; }

  static create(props: Omit<BlockProps, "createdAt" | "updatedAt">): Block {
    return new Block({
      ...props,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  static reconstitute(props: BlockProps): Block {
    return new Block(props);
  }
}

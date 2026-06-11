import { z } from "zod";
import { IndicatorIdSchema } from "./IndicatorId";

export const DimensionTypeSchema = z.enum(["day", "week", "month", "quarter", "year"]);
export type DimensionType = z.infer<typeof DimensionTypeSchema>;

export const IndicatorValueSchema = z.object({
  id: z.string().uuid(),
  indicatorId: IndicatorIdSchema,
  value: z.number(),
  periodStart: z.string(),
  periodEnd: z.string(),
  dimension: z.string().max(50),
  dimensionType: DimensionTypeSchema,
  metadataJson: z.string().default("{}"),
  createdAt: z.number().int().positive(),
});
export type IndicatorValueProps = z.infer<typeof IndicatorValueSchema>;

export class IndicatorValue {
  private constructor(private readonly props: IndicatorValueProps) {}

  get id(): string { return this.props.id; }
  get indicatorId(): string { return this.props.indicatorId; }
  get value(): number { return this.props.value; }
  get periodStart(): string { return this.props.periodStart; }
  get periodEnd(): string { return this.props.periodEnd; }
  get dimension(): string { return this.props.dimension; }
  get dimensionType(): DimensionType { return this.props.dimensionType; }
  get metadataJson(): string { return this.props.metadataJson; }
  get createdAt(): number { return this.props.createdAt; }

  toProps(): IndicatorValueProps {
    return { ...this.props };
  }

  static create(props: Omit<IndicatorValueProps, "createdAt" | "metadataJson"> & { createdAt?: number; metadataJson?: string }): IndicatorValue {
    return new IndicatorValue({
      ...props,
      metadataJson: props.metadataJson ?? "{}",
      createdAt: props.createdAt ?? Date.now(),
    });
  }

  static reconstitute(props: IndicatorValueProps): IndicatorValue {
    return new IndicatorValue(props);
  }
}

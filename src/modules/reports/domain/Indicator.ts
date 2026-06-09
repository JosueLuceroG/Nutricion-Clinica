import { z } from "zod";
import { IndicatorIdSchema, type IndicatorId } from "./IndicatorId";

export const IndicatorCategorySchema = z.enum(["consultas", "adherencia", "patologias", "financiero"]);
export type IndicatorCategory = z.infer<typeof IndicatorCategorySchema>;

export const IndicatorCalculationTypeSchema = z.enum(["count", "avg", "percentage", "ratio", "formula"]);
export type IndicatorCalculationType = z.infer<typeof IndicatorCalculationTypeSchema>;

export const IndicatorRefreshFrequencySchema = z.enum(["daily", "weekly", "monthly"]);
export type IndicatorRefreshFrequency = z.infer<typeof IndicatorRefreshFrequencySchema>;

export const IndicatorSchema = z.object({
  id: IndicatorIdSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(1000).default(""),
  category: IndicatorCategorySchema,
  unit: z.string().max(100).default(""),
  calculationType: IndicatorCalculationTypeSchema,
  formula: z.string().max(500).optional(),
  refreshFrequency: IndicatorRefreshFrequencySchema,
  metaValue: z.number().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});
export type IndicatorProps = z.infer<typeof IndicatorSchema>;

export class Indicator {
  private constructor(private readonly props: IndicatorProps) {}

  get id(): IndicatorId { return this.props.id as IndicatorId; }
  get name(): string { return this.props.name; }
  get description(): string { return this.props.description; }
  get category(): IndicatorCategory { return this.props.category; }
  get unit(): string { return this.props.unit; }
  get calculationType(): IndicatorCalculationType { return this.props.calculationType; }
  get formula(): string | undefined { return this.props.formula; }
  get refreshFrequency(): IndicatorRefreshFrequency { return this.props.refreshFrequency; }
  get metaValue(): number | undefined { return this.props.metaValue; }
  get isActive(): boolean { return this.props.isActive; }
  get createdAt(): number { return this.props.createdAt; }
  get updatedAt(): number { return this.props.updatedAt; }

  toProps(): IndicatorProps {
    return { ...this.props };
  }

  static create(props: Omit<IndicatorProps, "createdAt" | "updatedAt" | "isActive"> & { isActive?: boolean }): Indicator {
    return new Indicator({
      ...props,
      isActive: props.isActive ?? true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  static reconstitute(props: IndicatorProps): Indicator {
    return new Indicator(props);
  }

  with(updates: Partial<IndicatorProps>): Indicator {
    return Indicator.reconstitute({ ...this.props, ...updates, updatedAt: Date.now() });
  }
}

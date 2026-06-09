import { z } from "zod";

export const WidgetTypeSchema = z.enum(["kpi_card", "chart", "table", "list"]);
export type WidgetType = z.infer<typeof WidgetTypeSchema>;

export const DashboardConfigSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  widgetType: WidgetTypeSchema,
  title: z.string().min(1).max(200),
  indicatorIdsJson: z.string().default("[]"),
  position: z.number().int().min(0),
  settingsJson: z.string().default("{}"),
  isVisible: z.boolean().default(true),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});
export type DashboardConfigProps = z.infer<typeof DashboardConfigSchema>;

export class DashboardConfig {
  private constructor(private readonly props: DashboardConfigProps) {}

  get id(): string { return this.props.id; }
  get userId(): string { return this.props.userId; }
  get widgetType(): WidgetType { return this.props.widgetType; }
  get title(): string { return this.props.title; }
  get indicatorIdsJson(): string { return this.props.indicatorIdsJson; }
  get position(): number { return this.props.position; }
  get settingsJson(): string { return this.props.settingsJson; }
  get isVisible(): boolean { return this.props.isVisible; }
  get createdAt(): number { return this.props.createdAt; }
  get updatedAt(): number { return this.props.updatedAt; }

  toProps(): DashboardConfigProps {
    return { ...this.props };
  }

  static create(props: Omit<DashboardConfigProps, "createdAt" | "updatedAt" | "isVisible"> & { isVisible?: boolean }): DashboardConfig {
    return new DashboardConfig({
      ...props,
      isVisible: props.isVisible ?? true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  static reconstitute(props: DashboardConfigProps): DashboardConfig {
    return new DashboardConfig(props);
  }

  with(updates: Partial<DashboardConfigProps>): DashboardConfig {
    return DashboardConfig.reconstitute({ ...this.props, ...updates, updatedAt: Date.now() });
  }
}

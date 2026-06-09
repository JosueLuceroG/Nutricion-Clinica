import { z } from "zod";

export const ReportTypeSchema = z.enum(["operativo", "financiero", "regulatorio", "kpi"]);
export type ReportType = z.infer<typeof ReportTypeSchema>;

export const ReportStatusSchema = z.enum(["draft", "final", "archived"]);
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

export const GeneratedReportSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(300),
  type: ReportTypeSchema,
  parametersJson: z.string().default("{}"),
  contentHtml: z.string().default(""),
  generatedAt: z.number().int().positive(),
  generatedBy: z.string(),
  status: ReportStatusSchema,
});
export type GeneratedReportProps = z.infer<typeof GeneratedReportSchema>;

export class GeneratedReport {
  private constructor(private readonly props: GeneratedReportProps) {}

  get id(): string { return this.props.id; }
  get title(): string { return this.props.title; }
  get type(): ReportType { return this.props.type; }
  get parametersJson(): string { return this.props.parametersJson; }
  get contentHtml(): string { return this.props.contentHtml; }
  get generatedAt(): number { return this.props.generatedAt; }
  get generatedBy(): string { return this.props.generatedBy; }
  get status(): ReportStatus { return this.props.status; }

  toProps(): GeneratedReportProps {
    return { ...this.props };
  }

  static create(props: Omit<GeneratedReportProps, "generatedAt" | "status"> & { status?: ReportStatus }): GeneratedReport {
    return new GeneratedReport({
      ...props,
      status: props.status ?? "draft",
      generatedAt: Date.now(),
    });
  }

  static reconstitute(props: GeneratedReportProps): GeneratedReport {
    return new GeneratedReport(props);
  }

  with(updates: Partial<GeneratedReportProps>): GeneratedReport {
    return GeneratedReport.reconstitute({ ...this.props, ...updates });
  }

  finalize(): GeneratedReport {
    return this.with({ status: "final" });
  }

  archive(): GeneratedReport {
    return this.with({ status: "archived" });
  }
}

import { z } from "zod";
import { DocumentIdSchema, type DocumentId } from "./DocumentId";
import { DocumentTypeSchema, type DocumentType, DocumentStatusSchema, type DocumentStatus } from "./DocumentTypes";

export const DocumentSchema = z.object({
  id: DocumentIdSchema,
  patientId: z.string().uuid().optional(),
  consultationId: z.string().uuid().optional(),
  type: DocumentTypeSchema,
  title: z.string().min(1).max(300),
  contentHtml: z.string().default(""),
  parameters: z.string().default("{}"),
  status: DocumentStatusSchema,
  generatedBy: z.string().uuid(),
  generatedAt: z.number().int().positive(),
  signedAt: z.number().optional(),
  signedBy: z.string().uuid().optional(),
  signatureHash: z.string().optional(),
  voidReason: z.string().max(500).default(""),
  version: z.number().int().positive().default(1),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});
export type DocumentProps = z.infer<typeof DocumentSchema>;

export class NutriClinicaDocument {
  private constructor(private readonly props: DocumentProps) {}

  get id(): DocumentId { return this.props.id as DocumentId; }
  get patientId(): string | undefined { return this.props.patientId; }
  get consultationId(): string | undefined { return this.props.consultationId; }
  get type(): DocumentType { return this.props.type; }
  get title(): string { return this.props.title; }
  get contentHtml(): string { return this.props.contentHtml; }
  get parameters(): string { return this.props.parameters; }
  get status(): DocumentStatus { return this.props.status; }
  get generatedBy(): string { return this.props.generatedBy; }
  get generatedAt(): number { return this.props.generatedAt; }
  get signedAt(): number | undefined { return this.props.signedAt; }
  get signedBy(): string | undefined { return this.props.signedBy; }
  get signatureHash(): string | undefined { return this.props.signatureHash; }
  get voidReason(): string { return this.props.voidReason; }
  get version(): number { return this.props.version; }
  get createdAt(): number { return this.props.createdAt; }
  get updatedAt(): number { return this.props.updatedAt; }

  toProps(): DocumentProps { return { ...this.props }; }

  static create(props: Omit<DocumentProps, "createdAt" | "updatedAt" | "generatedAt" | "status" | "version" | "voidReason"> & { status?: DocumentStatus }): NutriClinicaDocument {
    return new NutriClinicaDocument({
      ...props,
      status: props.status ?? "draft",
      version: 1,
      voidReason: "",
      generatedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  static reconstitute(props: DocumentProps): NutriClinicaDocument {
    return new NutriClinicaDocument(props);
  }

  with(updates: Partial<DocumentProps>): NutriClinicaDocument {
    return NutriClinicaDocument.reconstitute({ ...this.props, ...updates, updatedAt: Date.now() });
  }

  sign(signedBy: string, signatureHash: string): NutriClinicaDocument {
    return this.with({ status: "signed", signedAt: Date.now(), signedBy, signatureHash });
  }

  deliver(): NutriClinicaDocument {
    return this.with({ status: "delivered" });
  }

  void(reason: string): NutriClinicaDocument {
    return this.with({ status: "voided", voidReason: reason });
  }
}

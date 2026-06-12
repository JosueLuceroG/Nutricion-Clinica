import { AuditEventId } from "./AuditEventId";

export type AuditAction = "create" | "update" | "remove" | "soft_delete" | "read" | "export" | "print" | "sign";
export type AuditResourceType =
  | "patient" | "consultation" | "allergy" | "medication" | "clinical_event"
  | "family_history" | "personal_history" | "habit" | "physical_activity"
  | "diet_history" | "intolerance" | "surgery" | "hospitalization"
  | "supplement" | "food_frequency" | "gi_symptom" | "snapshot" | "document"
  | "anthropometry" | "lab_panel" | "meal_plan";

export interface AuditEventProps {
  id: string;
  patientId: string | null;
  userId: string;
  ipAddress: string;
  module: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  previousValueHash: string | null;
  newValueHash: string | null;
  justification: string | null;
  createdAt: string;
}

export interface AuditEventCreate {
  patientId?: string | null;
  userId: string;
  ipAddress?: string;
  module: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  previousValueHash?: string | null;
  newValueHash?: string | null;
  justification?: string | null;
}

export class AuditEvent {
  private constructor(private readonly props: AuditEventProps) {}
  get id() { return AuditEventId.fromUnsafe(this.props.id); }
  get patientId() { return this.props.patientId; }
  get userId() { return this.props.userId; }
  get ipAddress() { return this.props.ipAddress; }
  get module() { return this.props.module; }
  get action() { return this.props.action; }
  get resourceType() { return this.props.resourceType; }
  get resourceId() { return this.props.resourceId; }
  get previousValueHash() { return this.props.previousValueHash; }
  get newValueHash() { return this.props.newValueHash; }
  get justification() { return this.props.justification; }
  get createdAt() { return this.props.createdAt; }
  toProps(): AuditEventProps { return { ...this.props }; }

  static create(input: AuditEventCreate): AuditEvent {
    return new AuditEvent({
      id: AuditEventId.generate().value,
      patientId: input.patientId ?? null,
      userId: input.userId,
      ipAddress: input.ipAddress ?? "local",
      module: input.module,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      previousValueHash: input.previousValueHash ?? null,
      newValueHash: input.newValueHash ?? null,
      justification: input.justification ?? null,
      createdAt: new Date().toISOString(),
    });
  }

  static reconstitute(props: AuditEventProps): AuditEvent {
    return new AuditEvent(props);
  }
}

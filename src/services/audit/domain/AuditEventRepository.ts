import type { AuditEventProps } from "../domain/AuditEvent";

export interface AuditEventRepository {
  save(event: AuditEventProps): Promise<void>;
  findByPatientId(patientId: string): Promise<AuditEventProps[]>;
  findByUserId(userId: string, limit?: number): Promise<AuditEventProps[]>;
  findByResource(resourceType: string, resourceId: string): Promise<AuditEventProps[]>;
}

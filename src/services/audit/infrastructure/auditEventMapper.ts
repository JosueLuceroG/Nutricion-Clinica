import type { AuditEventProps } from "../domain/AuditEvent";

export interface AuditEventRow {
  id: string; patient_id: string | null; user_id: string;
  ip_address: string; module: string; action: string;
  resource_type: string; resource_id: string;
  previous_value_hash: string | null; new_value_hash: string | null;
  justification: string | null; created_at: string;
}

export const auditEventRowToProps = (row: AuditEventRow): AuditEventProps => ({
  id: row.id, patientId: row.patient_id, userId: row.user_id,
  ipAddress: row.ip_address, module: row.module,
  action: row.action as AuditEventProps["action"],
  resourceType: row.resource_type as AuditEventProps["resourceType"],
  resourceId: row.resource_id,
  previousValueHash: row.previous_value_hash,
  newValueHash: row.new_value_hash,
  justification: row.justification, createdAt: row.created_at,
});

export const auditEventPropsToRow = (p: AuditEventProps): AuditEventRow => ({
  id: p.id, patient_id: p.patientId, user_id: p.userId,
  ip_address: p.ipAddress, module: p.module, action: p.action,
  resource_type: p.resourceType, resource_id: p.resourceId,
  previous_value_hash: p.previousValueHash,
  new_value_hash: p.newValueHash,
  justification: p.justification, created_at: p.createdAt,
});

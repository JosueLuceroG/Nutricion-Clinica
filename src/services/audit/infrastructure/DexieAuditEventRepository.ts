import type { AuditEventRepository } from "../domain/AuditEventRepository";
import type { AuditEventProps } from "../domain/AuditEvent";
import { auditEventRowToProps, auditEventPropsToRow, type AuditEventRow } from "./auditEventMapper";
import type { NutriClinicaDB } from "@services/db/dexieSchema";

export class DexieAuditEventRepository implements AuditEventRepository {
  private get table() { return this.db.audit_events; }
  constructor(private readonly db: NutriClinicaDB) {}

  async save(event: AuditEventProps): Promise<void> {
    await this.table.add(auditEventPropsToRow(event) as AuditEventRow);
  }

  async findByPatientId(patientId: string): Promise<AuditEventProps[]> {
    const rows = await this.table.where("patient_id").equals(patientId).toArray();
    return rows.map(auditEventRowToProps);
  }

  async findByUserId(userId: string, limit = 100): Promise<AuditEventProps[]> {
    const rows = await this.table.where("user_id").equals(userId).limit(limit).toArray();
    return rows.map(auditEventRowToProps);
  }

  async findByResource(resourceType: string, resourceId: string): Promise<AuditEventProps[]> {
    const rows = await this.table
      .where("resource_type").equals(resourceType)
      .and((r) => r.resource_id === resourceId)
      .toArray();
    return rows.map(auditEventRowToProps);
  }
}

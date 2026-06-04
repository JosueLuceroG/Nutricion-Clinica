import { DexieAuditEventRepository } from "./infrastructure/DexieAuditEventRepository";
import { AuditEvent, type AuditEventCreate } from "./domain/AuditEvent";
import type { AuditEventRepository } from "./domain/AuditEventRepository";
import { db } from "@services/db/dexieSchema";

const repository: AuditEventRepository = new DexieAuditEventRepository(db);

export const auditService = {
  async record(input: AuditEventCreate): Promise<AuditEvent> {
    const event = AuditEvent.create(input);
    await repository.save(event.toProps());
    return event;
  },
  async findByPatientId(patientId: string) {
    const props = await repository.findByPatientId(patientId);
    return props.map(AuditEvent.reconstitute);
  },
  async findByUserId(userId: string, limit?: number) {
    const props = await repository.findByUserId(userId, limit);
    return props.map(AuditEvent.reconstitute);
  },
  async findByResource(resourceType: string, resourceId: string) {
    const props = await repository.findByResource(resourceType, resourceId);
    return props.map(AuditEvent.reconstitute);
  },
};

export type AuditService = typeof auditService;

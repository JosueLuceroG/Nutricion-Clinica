import { auditService } from "./auditService";
import type { AuditAction, AuditResourceType } from "./domain/AuditEvent";
import { useAuthStore } from "@store/authStore";

interface ClinicalAuditInput {
  module: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  patientId?: string | null;
  justification?: string | null;
}

export function getCurrentAuditUserId(): string {
  return useAuthStore.getState().user?.id ?? "system";
}

export async function recordClinicalAudit(input: ClinicalAuditInput): Promise<void> {
  try {
    await auditService.record({
      ...input,
      userId: getCurrentAuditUserId(),
    });
  } catch (err) {
    console.warn("[audit] local clinical audit failed:", err instanceof Error ? err.message : err);
  }
}

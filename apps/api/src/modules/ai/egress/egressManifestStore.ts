import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import { getPool } from '../../../db/connection.js';
import type { EgressManifest } from './egressManifest.js';

export interface EgressManifestStore {
  save(manifest: EgressManifest): Promise<void>;
}

export class SqlEgressManifestStore implements EgressManifestStore {
  async save(manifest: EgressManifest): Promise<void> {
    try {
      const pool = await getPool();
      await pool
        .request()
        .input('id', sql.UniqueIdentifier(), manifest.manifestId)
        .input('execution_id', sql.UniqueIdentifier(), manifest.executionId)
        .input('user_id', sql.UniqueIdentifier(), manifest.userId ?? null)
        .input('role', sql.NVarChar(60), manifest.role ?? null)
        .input('sucursal_id', sql.UniqueIdentifier(), manifest.sucursalId ?? null)
        .input('patient_ref', sql.NVarChar(64), manifest.patientRef ?? null)
        .input('capability', sql.NVarChar(100), manifest.capability)
        .input('purpose', sql.NVarChar(100), manifest.purpose)
        .input('provider', sql.NVarChar(60), manifest.provider)
        .input('model', sql.NVarChar(120), manifest.model)
        .input('provider_location_type', sql.NVarChar(20), manifest.providerLocationType)
        .input('data_categories', sql.NVarChar(sql.MAX), JSON.stringify(manifest.dataCategories))
        .input('field_groups', sql.NVarChar(sql.MAX), JSON.stringify(manifest.fieldGroups))
        .input('redaction_applied', sql.Bit, manifest.redactionApplied ? 1 : 0)
        .input('pseudonymization_applied', sql.Bit, manifest.pseudonymizationApplied ? 1 : 0)
        .input('consent_reference', sql.UniqueIdentifier(), manifest.consentReference ?? null)
        .input('decision', sql.NVarChar(10), manifest.decision)
        .input('reason_codes', sql.NVarChar(sql.MAX), JSON.stringify(manifest.reasonCodes))
        .input('policy_version', sql.NVarChar(20), manifest.policyVersion)
        .input('occurred_at', sql.DateTime2(3), manifest.occurredAt)
        .query(
          `INSERT INTO ai_egress_manifests (
             id, execution_id, user_id, role, sucursal_id, patient_ref, capability, purpose,
             provider, model, provider_location_type, data_categories, field_groups,
             redaction_applied, pseudonymization_applied, consent_reference, decision,
             reason_codes, policy_version, occurred_at
           ) VALUES (
             @id, @execution_id, @user_id, @role, @sucursal_id, @patient_ref, @capability, @purpose,
             @provider, @model, @provider_location_type, @data_categories, @field_groups,
             @redaction_applied, @pseudonymization_applied, @consent_reference, @decision,
             @reason_codes, @policy_version, @occurred_at
           )`,
        );
    } catch (err) {
      console.warn('[egress] manifest persistence failed:', err instanceof Error ? err.message : err);
    }
  }
}

export class InMemoryEgressManifestStore implements EgressManifestStore {
  readonly manifests: EgressManifest[] = [];

  async save(manifest: EgressManifest): Promise<void> {
    this.manifests.push(manifest);
  }

  clear(): void {
    this.manifests.length = 0;
  }

  all(): EgressManifest[] {
    return this.manifests;
  }
}

export class NoopEgressManifestStore implements EgressManifestStore {
  async save(): Promise<void> {}
}

export function createManifestId(): string {
  return randomUUID();
}
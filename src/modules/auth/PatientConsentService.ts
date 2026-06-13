import { db } from "@services/db/dexieSchema";
import type { Table } from "dexie";
import { recordClinicalAudit } from "@services/audit/clinicalAudit";

export interface PatientConsent {
  id: string;
  patient_id: string;
  type: "treatment" | "data_sharing" | "ai_opt_in";
  signed_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  document_hash?: string;
}

export const ConsentService = {
  get table(): Table<PatientConsent, string> {
    return db.patient_consents;
  },

  async recordConsent(consent: PatientConsent): Promise<string> {
    await this.table.put(consent);
    await recordClinicalAudit({
      module: "patient_consents",
      action: "create",
      resourceType: "patient_consent",
      resourceId: consent.id,
      patientId: consent.patient_id,
      justification: `type:${consent.type}`,
    });
    return consent.id;
  },

  async revokeConsent(id: string): Promise<void> {
    const existing = await this.table.get(id);
    await this.table.update(id, {
      revoked_at: new Date().toISOString(),
    });
    await recordClinicalAudit({
      module: "patient_consents",
      action: "update",
      resourceType: "patient_consent",
      resourceId: id,
      patientId: existing?.patient_id ?? null,
      justification: "revoke",
    });
  },

  async isConsentActive(
    patientId: string,
    type: PatientConsent["type"],
  ): Promise<boolean> {
    const consents = await this.table
      .where({ patient_id: patientId, type })
      .toArray();
    return consents.some((c) => {
      if (c.revoked_at) return false;
      if (c.expires_at && new Date(c.expires_at) < new Date()) return false;
      return true;
    });
  },

  async listByPatient(patientId: string): Promise<PatientConsent[]> {
    return this.table
      .where("patient_id")
      .equals(patientId)
      .reverse()
      .sortBy("signed_at");
  },
};

export type ConsentService = typeof ConsentService;

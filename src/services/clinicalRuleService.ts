import { db } from "@services/db/dexieSchema";
import { DexieClinicalRecordRepository } from "@modules/clinical-record/infrastructure/DexieClinicalRecordRepository";
import { DexieFoodRepository } from "@modules/smae/infrastructure/DexieFoodRepository";
import { ClinicalRuleEngine } from "@modules/clinical-record/application/clinicalRuleEngine";
import type { PatientId } from "@modules/patient/domain/PatientId";
import { DexiePatientRepository } from "@modules/patient/infrastructure/DexiePatientRepository";

const clinicalRecordRepo = new DexieClinicalRecordRepository(db);
const foodRepo = new DexieFoodRepository(db);
const patientRepo = new DexiePatientRepository(db);
const engine = new ClinicalRuleEngine(clinicalRecordRepo, foodRepo, patientRepo);

export const clinicalRuleService = {
  generateClinicalTags: (patientId: string): Promise<string[]> =>
    engine.generateClinicalTags(patientId),

  getBlockedFoodIds: (patientId: string): Promise<string[]> =>
    engine.getBlockedFoodIds(patientId),

  getFoodWarnings: (patientId: string): Promise<Array<{ foodId: string; intoleranceFood: string; severity: string }>> =>
    engine.getFoodWarnings(patientId),

  validateConsent: (patientId: string): Promise<{ valid: boolean; reason: string | null }> =>
    engine.validateConsent(patientId),

  updatePatientTags: async (patientId: PatientId): Promise<string[]> => {
    const tags = await engine.generateClinicalTags(patientId.toString());
    const existing = await patientRepo.findById(patientId);
    if (!existing) return [];
    const updated = existing.with({ clinicalTags: tags });
    await patientRepo.save(updated);
    return tags;
  },
};

export type ClinicalRuleService = typeof clinicalRuleService;

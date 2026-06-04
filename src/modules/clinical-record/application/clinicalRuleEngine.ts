import type { PatientRepository } from "@modules/patient/domain/PatientRepository";
import { PatientId } from "@modules/patient/domain/PatientId";
import type { ClinicalRecordRepository } from "../domain/ClinicalRecordRepository";
import { SYSTEM_FOODS, searchFoods, type FoodRepository } from "@modules/smae/domain";
import type { PersonalCondition } from "../domain/PersonalHistory";
import type { Condition } from "../domain/FamilyHistory";

const PERSONAL_CONDITION_TAGS: Record<PersonalCondition, string[]> = {
  diabetes_tipo_1: ["diabetico"],
  diabetes_tipo_2: ["diabetico"],
  hta: ["hipertenso"],
  dislipidemia: ["dislipidemico"],
  obesidad: ["obesidad"],
  erc: ["enfermedad-renal"],
  higado_graso: ["higado-graso"],
  sindrome_metabolico: ["sindrome-metabolico"],
  tiroidea: ["tiroideo"],
  anemia: ["anemia"],
  gastrointestinal: ["gastrointestinal"],
  autoinmune: ["autoinmune"],
  cancer: ["cancer"],
  cardiopatia: ["cardiopatia"],
  depresion: ["depresion"],
  trastorno_alimentario: ["trastorno-alimentario"],
  covid: ["covid"],
  otro: [],
};

const FAMILY_CONDITION_TAGS: Record<Condition, string[]> = {
  diabetes: ["antecedente-familiar-diabetes"],
  hta: ["antecedente-familiar-hta"],
  obesidad: ["antecedente-familiar-obesidad"],
  cancer: ["antecedente-familiar-cancer"],
  ecv: ["antecedente-familiar-ecv"],
  erc: ["antecedente-familiar-erc"],
  tiroidea: ["antecedente-familiar-tiroidea"],
  autoinmune: ["antecedente-familiar-autoinmune"],
  osteoporosis: ["antecedente-familiar-osteoporosis"],
  dislipidemia: ["antecedente-familiar-dislipidemia"],
  otro: [],
};

export class ClinicalRuleEngine {
  constructor(
    private readonly clinicalRecordRepo: ClinicalRecordRepository,
    private readonly foodRepo: FoodRepository,
    private readonly patientRepo?: PatientRepository,
  ) {}

  async generateClinicalTags(patientId: string): Promise<string[]> {
    const tagSet = new Set<string>();

    const personalHistories = await this.clinicalRecordRepo.findPersonalHistories(patientId);
    for (const ph of personalHistories) {
      const mapped = PERSONAL_CONDITION_TAGS[ph.condition];
      if (mapped) mapped.forEach((t) => tagSet.add(t));
    }

    const familyHistories = await this.clinicalRecordRepo.findFamilyHistories(patientId);
    for (const fh of familyHistories) {
      const mapped = FAMILY_CONDITION_TAGS[fh.condition];
      if (mapped) mapped.forEach((t) => tagSet.add(t));
    }

    return Array.from(tagSet).sort();
  }

  async getBlockedFoodIds(patientId: string): Promise<string[]> {
    const allergies = await this.clinicalRecordRepo.findAllergies(patientId);
    if (allergies.length === 0) return [];

    const customFoods = await this.foodRepo.findAllCustom();
    const allFoods = [...SYSTEM_FOODS, ...customFoods];
    const blocked = new Set<string>();

    for (const allergy of allergies) {
      const allergen = allergy.allergen.toLowerCase().trim();
      if (!allergen) continue;
      const matches = searchFoods(allFoods, { query: allergen });
      matches.forEach((f) => blocked.add(f.id));
    }

    return Array.from(blocked).sort();
  }

  async getFoodWarnings(patientId: string): Promise<Array<{ foodId: string; intoleranceFood: string; severity: string }>> {
    const intolerances = await this.clinicalRecordRepo.findIntolerances(patientId);
    if (intolerances.length === 0) return [];

    const customFoods = await this.foodRepo.findAllCustom();
    const allFoods = [...SYSTEM_FOODS, ...customFoods];
    const warnings: Array<{ foodId: string; intoleranceFood: string; severity: string }> = [];
    const seen = new Set<string>();

    for (const intolerance of intolerances) {
      const food = intolerance.food.toLowerCase().trim();
      if (!food) continue;
      const matches = searchFoods(allFoods, { query: food });
      for (const match of matches) {
        const key = `${match.id}:${intolerance.id.toString()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        warnings.push({
          foodId: match.id,
          intoleranceFood: intolerance.food,
          severity: intolerance.severity,
        });
      }
    }

    return warnings;
  }

  /** RN-EXP-01: todo paciente debe tener consentimiento firmado antes de la primera consulta clínica. */
  async validateConsent(patientId: string): Promise<{ valid: boolean; reason: string | null }> {
    if (!this.patientRepo) {
      return { valid: true, reason: null };
    }
    const patient = await this.patientRepo.findById(PatientId.fromUnsafe(patientId));
    if (!patient) {
      return { valid: false, reason: "Paciente no encontrado" };
    }
    if (!patient.hasSignedConsent) {
      return { valid: false, reason: "El paciente debe tener consentimiento informado firmado antes de la primera consulta (RN-EXP-01)" };
    }
    return { valid: true, reason: null };
  }
}

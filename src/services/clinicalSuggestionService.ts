import { ClinicalSuggestionEngine } from "@modules/clinical-engine/application/ClinicalSuggestionEngine";
import type { Patient } from "@modules/patient/domain/Patient";
import type { Vitals } from "@modules/consultation/domain/Vitals";
import type { PatientId } from "@modules/patient/domain/PatientId";
import { AnthropometryId } from "@modules/anthropometry/domain/AnthropometryId";
import { LabPanelId } from "@modules/laboratory/domain/LabPanelId";
import { patientService } from "./patientService";
import { anthropometryService } from "./anthropometryService";
import { labPanelService } from "./labPanelService";
import type {
  DiagnosticSuggestion,
  PlanTargetSuggestion,
} from "@modules/clinical-engine/domain/Suggestion";

/**
 * Servicio de aplicaci\u00f3n que re\u00fane los datos cl\u00ednicos necesarios para
 * invocar al motor de sugerencias y devuelve un payload listo para la UI.
 */
export interface SuggestionContext {
  patient: Patient;
  anthropometry: Awaited<ReturnType<typeof anthropometryService.get.execute>>;
  labPanel: Awaited<ReturnType<typeof labPanelService.get.execute>>;
  vitals: Vitals;
}

export interface SuggestionBundle {
  diagnostics: DiagnosticSuggestion[];
  plan: PlanTargetSuggestion | null;
}

export const clinicalSuggestionService = {
  engine: new ClinicalSuggestionEngine(),

  async gather(patientId: PatientId, opts: {
    anthropometryId: string | null;
    labPanelId: string | null;
    vitals: Vitals;
  }): Promise<SuggestionBundle> {
    const patient = await patientService.get.execute(patientId);
    const anthropometry = opts.anthropometryId
      ? await anthropometryService.get.execute(AnthropometryId.fromUnsafe(opts.anthropometryId))
      : null;
    const labPanel = opts.labPanelId
      ? await labPanelService.get.execute(LabPanelId.fromUnsafe(opts.labPanelId))
      : null;

    const diagnostics = this.engine.suggestDiagnoses({
      patient,
      anthropometry,
      labPanel,
      vitals: opts.vitals,
    });
    const plan = this.engine.suggestMealPlanTargets({
      patient,
      anthropometry,
      labPanel,
      vitals: opts.vitals,
    });
    return { diagnostics, plan };
  },
};

export type ClinicalSuggestionService = typeof clinicalSuggestionService;

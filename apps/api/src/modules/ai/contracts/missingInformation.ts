/** missing_information formal: derivado de requisitos y fallos reales, no solo texto libre del LLM. */
export type MissingInformationSource =
  | 'capability_requirements'
  | 'tool_failure'
  | 'evidence'
  | 'patient_data'
  | 'document_support';

export type MissingInformationCode =
  | 'REQUIRED_EVIDENCE'
  | 'REQUIRED_CAPABILITY_FIELD'
  | 'TOOL_UNAVAILABLE'
  | 'PATIENT_DATA_MISSING'
  | 'DOCUMENT_SUPPORT_MISSING'
  | 'STALE_REQUIRED_DATA'
  | 'GROUNDING_FAILURE';

export interface MissingInfoItem {
  code: MissingInformationCode;
  detail?: string;
  source: MissingInformationSource;
}

export interface MissingInformationInput {
  requiredCapabilityFields: string[];
  presentCapabilityFields: string[];
  toolFailures: string[];
  missingEvidence: string[];
  staleData: string[];
  documentSupportMissing: string[];
  groundingFailed: boolean;
}

export function deriveMissingInformation(input: MissingInformationInput): MissingInfoItem[] {
  const missing: MissingInfoItem[] = [];

  const absentFields = input.requiredCapabilityFields.filter((field) => !input.presentCapabilityFields.includes(field));
  for (const field of absentFields) {
    missing.push({ code: 'REQUIRED_CAPABILITY_FIELD', detail: `Campo requerido ausente: ${field}`, source: 'capability_requirements' });
  }
  for (const failure of input.toolFailures) {
    missing.push({ code: 'TOOL_UNAVAILABLE', detail: `Herramienta no disponible: ${failure}`, source: 'tool_failure' });
  }
  for (const evidence of input.missingEvidence) {
    missing.push({ code: 'REQUIRED_EVIDENCE', detail: `Evidencia requerida ausente: ${evidence}`, source: 'evidence' });
  }
  for (const stale of input.staleData) {
    missing.push({ code: 'STALE_REQUIRED_DATA', detail: `Dato requerido vencido: ${stale}`, source: 'patient_data' });
  }
  for (const doc of input.documentSupportMissing) {
    missing.push({ code: 'DOCUMENT_SUPPORT_MISSING', detail: `Soporte documental ausente: ${doc}`, source: 'document_support' });
  }
  if (input.groundingFailed) {
    missing.push({ code: 'GROUNDING_FAILURE', detail: 'Grounding fallido (citas sin respaldo)', source: 'document_support' });
  }
  return missing;
}
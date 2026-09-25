/** Tipos de claim clínicos. El frontend NO los define; el backend valida el tipo contra la procedencia. */
export type ClaimType =
  | 'OBSERVED_FACT'
  | 'OBSERVED_TREND'
  | 'CALCULATED_VALUE'
  | 'RULE_RESULT'
  | 'DOCUMENTED_GUIDANCE'
  | 'AI_INTERPRETATION'
  | 'AI_RECOMMENDATION';

export const CLAIM_TYPES: readonly ClaimType[] = [
  'OBSERVED_FACT',
  'OBSERVED_TREND',
  'CALCULATED_VALUE',
  'RULE_RESULT',
  'DOCUMENTED_GUIDANCE',
  'AI_INTERPRETATION',
  'AI_RECOMMENDATION',
];

export interface ClaimProvenanceLike {
  sourceType: string;
  generator?: 'ai' | 'deterministic';
  calculationId?: string;
  calculationVersion?: string;
  ruleId?: string;
  ruleVersion?: string;
  documentId?: string;
  documentVersion?: string;
  metricId?: string;
  metricVersion?: string;
  period?: string;
  loadRunId?: number | null;
  reconciliationStatus?: string;
  observedAt?: string | null;
  evidenceCount?: number;
}

export interface ClaimValidationResult {
  valid: boolean;
  reason?: string;
}

const DETERMINISTIC_SOURCE_TYPES = ['ERP', 'DWH', 'CALCULATOR', 'RULE_ENGINE'];

function requireAll(provenance: ClaimProvenanceLike, fields: Array<keyof ClaimProvenanceLike>, claimType: ClaimType, label: string): ClaimValidationResult {
  const missing = fields.filter((field) => !provenance[field]);
  if (missing.length > 0) {
    return { valid: false, reason: `${claimType} requiere ${label} (faltan: ${missing.join(', ')})` };
  }
  return { valid: true };
}

/**
 * Un claim solo es válido si su tipo es coherente con su procedencia.
 * Una inferencia del modelo NUNCA puede declararse OBSERVED_FACT, CALCULATED_VALUE o RULE_RESULT.
 */
export function validateClaimType(claimType: ClaimType, provenance: ClaimProvenanceLike): ClaimValidationResult {
  switch (claimType) {
    case 'OBSERVED_FACT':
      if (provenance.generator === 'ai') {
        return { valid: false, reason: 'OBSERVED_FACT no puede provenir de inferencia del modelo' };
      }
      if (!['ERP', 'DWH'].includes(provenance.sourceType)) {
        return { valid: false, reason: `OBSERVED_FACT requiere fuente ERP/DWH (recibida: ${provenance.sourceType})` };
      }
      return { valid: true };
    case 'OBSERVED_TREND':
      if (provenance.generator === 'ai') {
        return { valid: false, reason: 'OBSERVED_TREND no puede provenir de inferencia del modelo' };
      }
      if (!['ERP', 'DWH'].includes(provenance.sourceType)) {
        return { valid: false, reason: `OBSERVED_TREND requiere fuente ERP/DWH (recibida: ${provenance.sourceType})` };
      }
      if ((provenance.evidenceCount ?? 0) < 2) {
        return { valid: false, reason: 'OBSERVED_TREND requiere al menos 2 observaciones con fecha' };
      }
      return { valid: true };
    case 'CALCULATED_VALUE':
      if (provenance.generator === 'ai') {
        return { valid: false, reason: 'CALCULATED_VALUE no puede ser inventado por el modelo' };
      }
      if (!DETERMINISTIC_SOURCE_TYPES.includes(provenance.sourceType) && provenance.sourceType !== 'CALCULATOR') {
        return { valid: false, reason: `CALCULATED_VALUE requiere calculadora determinista (recibida: ${provenance.sourceType})` };
      }
      return requireAll(provenance, ['calculationId', 'calculationVersion'], claimType, 'calculation_id + calculation_version');
    case 'RULE_RESULT':
      if (provenance.generator === 'ai') {
        return { valid: false, reason: 'RULE_RESULT no puede provenir de texto del modelo' };
      }
      if (provenance.sourceType !== 'RULE_ENGINE') {
        return { valid: false, reason: `RULE_RESULT requiere RULE_ENGINE (recibida: ${provenance.sourceType})` };
      }
      return requireAll(provenance, ['ruleId', 'ruleVersion'], claimType, 'rule_id + rule_version');
    case 'DOCUMENTED_GUIDANCE':
      if (provenance.generator === 'ai') {
        return { valid: false, reason: 'DOCUMENTED_GUIDANCE requiere documento aprobado, no invención del modelo' };
      }
      if (!['RAG', 'ERP', 'DWH'].includes(provenance.sourceType)) {
        return { valid: false, reason: `DOCUMENTED_GUIDANCE requiere fuente documental RAG (recibida: ${provenance.sourceType})` };
      }
      return requireAll(provenance, ['documentId', 'documentVersion'], claimType, 'document_id + document_version');
    case 'AI_INTERPRETATION':
      if (provenance.generator !== 'ai') {
        return { valid: false, reason: 'AI_INTERPRETATION requiere generación por modelo' };
      }
      return { valid: true };
    case 'AI_RECOMMENDATION':
      if (provenance.generator !== 'ai') {
        return { valid: false, reason: 'AI_RECOMMENDATION requiere generación por modelo' };
      }
      return { valid: true };
  }
}
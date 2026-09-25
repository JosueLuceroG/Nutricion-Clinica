import { describe, expect, it } from 'vitest';
import { CLAIM_TYPES, validateClaimType } from './claimTypes.js';
import { validateEvidenceEnvelope, type EvidenceEnvelopeV2 } from './evidenceEnvelope.js';
import { assertConfidenceCategory, CONFIDENCE_CATEGORIES, computeConfidence, type ConfidenceFactors } from './confidenceEngine.js';
import { deriveMissingInformation } from './missingInformation.js';
import { detectContradictions } from './contradictionDetection.js';

describe('claimTypes (Build 05, spec 59)', () => {
  it('define las siete categorías de claim', () => {
    expect(CLAIM_TYPES).toEqual([
      'OBSERVED_FACT',
      'OBSERVED_TREND',
      'CALCULATED_VALUE',
      'RULE_RESULT',
      'DOCUMENTED_GUIDANCE',
      'AI_INTERPRETATION',
      'AI_RECOMMENDATION',
    ]);
  });

  it('el modelo jamás puede declarar OBSERVED_FACT / CALCULATED_VALUE / RULE_RESULT', () => {
    const ai = { generator: 'ai' as const, sourceType: 'MODEL_INFERENCE' };
    expect(validateClaimType('OBSERVED_FACT', ai).valid).toBe(false);
    expect(validateClaimType('CALCULATED_VALUE', ai).valid).toBe(false);
    expect(validateClaimType('RULE_RESULT', ai).valid).toBe(false);
    expect(validateClaimType('DOCUMENTED_GUIDANCE', ai).valid).toBe(false);
    expect(validateClaimType('OBSERVED_TREND', ai).valid).toBe(false);
  });

  it('OBSERVED_FACT requiere ERP/DWH y nunca inferencia', () => {
    expect(validateClaimType('OBSERVED_FACT', { sourceType: 'ERP', generator: 'deterministic' }).valid).toBe(true);
    expect(validateClaimType('OBSERVED_FACT', { sourceType: 'RAG', generator: 'deterministic' }).valid).toBe(false);
  });

  it('OBSERVED_TREND requiere al menos 2 observaciones fechadas', () => {
    const base = { sourceType: 'ERP', generator: 'deterministic' as const };
    expect(validateClaimType('OBSERVED_TREND', { ...base, evidenceCount: 2 }).valid).toBe(true);
    expect(validateClaimType('OBSERVED_TREND', { ...base, evidenceCount: 1 }).valid).toBe(false);
    expect(validateClaimType('OBSERVED_TREND', { ...base, evidenceCount: 0 }).valid).toBe(false);
  });

  it('CALCULATED_VALUE requiere calculadora determinista con id+versión', () => {
    expect(validateClaimType('CALCULATED_VALUE', { sourceType: 'CALCULATOR', generator: 'deterministic', calculationId: 'calc-1', calculationVersion: 'v1' }).valid).toBe(true);
    expect(validateClaimType('CALCULATED_VALUE', { sourceType: 'CALCULATOR', generator: 'deterministic' }).valid).toBe(false);
    expect(validateClaimType('CALCULATED_VALUE', { sourceType: 'RAG', generator: 'deterministic', calculationId: 'x', calculationVersion: 'v1' }).valid).toBe(false);
  });

  it('RULE_RESULT requiere RULE_ENGINE con id+versión', () => {
    expect(validateClaimType('RULE_RESULT', { sourceType: 'RULE_ENGINE', generator: 'deterministic', ruleId: 'r1', ruleVersion: 'v1' }).valid).toBe(true);
    expect(validateClaimType('RULE_RESULT', { sourceType: 'RULE_ENGINE', generator: 'deterministic' }).valid).toBe(false);
  });

  it('DOCUMENTED_GUIDANCE requiere documento aprobado con id+versión', () => {
    expect(validateClaimType('DOCUMENTED_GUIDANCE', { sourceType: 'RAG', generator: 'deterministic', documentId: 'd1', documentVersion: 'v2' }).valid).toBe(true);
    expect(validateClaimType('DOCUMENTED_GUIDANCE', { sourceType: 'RAG', generator: 'deterministic' }).valid).toBe(false);
  });

  it('AI_INTERPRETATION / AI_RECOMMENDATION requieren generación por modelo', () => {
    expect(validateClaimType('AI_INTERPRETATION', { sourceType: 'MODEL_INFERENCE', generator: 'ai' }).valid).toBe(true);
    expect(validateClaimType('AI_RECOMMENDATION', { sourceType: 'MODEL_INFERENCE', generator: 'ai' }).valid).toBe(true);
    expect(validateClaimType('AI_INTERPRETATION', { sourceType: 'ERP', generator: 'deterministic' }).valid).toBe(false);
    expect(validateClaimType('AI_RECOMMENDATION', { sourceType: 'ERP', generator: 'deterministic' }).valid).toBe(false);
  });
});

describe('confidenceEngine (Build 05, spec 61)', () => {
  it('confianza categórica exclusiva', () => {
    expect(CONFIDENCE_CATEGORIES).toEqual(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_EVIDENCE']);
  });

  it('rechaza porcentajes y números arbitrarios', () => {
    expect(() => assertConfidenceCategory(93)).toThrow();
    expect(() => assertConfidenceCategory(0.93)).toThrow();
    expect(() => assertConfidenceCategory('93%')).toThrow();
    expect(() => assertConfidenceCategory('high')).toThrow();
    expect(assertConfidenceCategory('HIGH')).toBe('HIGH');
    expect(assertConfidenceCategory('INSUFFICIENT_EVIDENCE')).toBe('INSUFFICIENT_EVIDENCE');
  });

  const full: ConfidenceFactors = {
    requiredEvidenceCount: 3,
    evidenceCount: 3,
    authoritativeSources: 3,
    contradictions: 0,
    missingRequired: 0,
    staleSources: 0,
    validatorFailures: 0,
    groundingValid: true,
    groundingRequired: true,
    toolSuccess: true,
    sourceTier: 'authoritative',
    citationValid: true,
  };

  it('fuentes autoritativas consistentes y citadas → HIGH', () => {
    expect(computeConfidence(full)).toBe('HIGH');
  });

  it('contradicción → INSUFFICIENT_EVIDENCE', () => {
    expect(computeConfidence({ ...full, contradictions: 1 })).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('dato requerido ausente → INSUFFICIENT_EVIDENCE', () => {
    expect(computeConfidence({ ...full, missingRequired: 1 })).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('fallo de validador o tool fallida → INSUFFICIENT_EVIDENCE', () => {
    expect(computeConfidence({ ...full, validatorFailures: 1 })).toBe('INSUFFICIENT_EVIDENCE');
    expect(computeConfidence({ ...full, toolSuccess: false })).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('grounding requerido y ausente → INSUFFICIENT_EVIDENCE', () => {
    expect(computeConfidence({ ...full, groundingValid: false })).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('evidencia parcial → LOW', () => {
    expect(computeConfidence({ ...full, evidenceCount: 2 })).toBe('LOW');
  });

  it('fuente débil → LOW; estándar → MEDIUM', () => {
    expect(computeConfidence({ ...full, sourceTier: 'weak' })).toBe('LOW');
    expect(computeConfidence({ ...full, sourceTier: 'standard' })).toBe('MEDIUM');
  });
});

describe('evidenceEnvelope v2 (Build 05, spec 60)', () => {
  const validEnvelope: EvidenceEnvelopeV2 = {
    version: '2.0',
    capability: 'nutrition_reasoning',
    generatedAt: '2026-08-17T00:00:00.000Z',
    riskLevel: 'RISK_3',
    baseRisk: 'RISK_3',
    confidence: 'HIGH',
    requiresProfessionalReview: true,
    claims: [
      {
        id: 'c1',
        text: 'IMC calculado 24.2',
        claimType: 'CALCULATED_VALUE',
        evidence: [{ source: 'imc', sourceType: 'CALCULATOR', calculationId: 'imc', calculationVersion: 'v1', supports: ['cálculo'] }],
        confidence: 'HIGH',
        missingInformation: [],
        contradictions: [],
      },
    ],
    missingInformation: [],
    contradictions: [],
  };

  it('envelope válido pasa la validación estricta', () => {
    const result = validateEvidenceEnvelope(validEnvelope);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rechaza versiones legacy y JSON parcial', () => {
    expect(validateEvidenceEnvelope({ ...validEnvelope, version: '1.0' as never }).valid).toBe(false);
    expect(validateEvidenceEnvelope({ ...validEnvelope, claims: [] }).valid).toBe(false);
    expect(validateEvidenceEnvelope({ ...validEnvelope, confidence: '93%' as never }).valid).toBe(false);
    expect(validateEvidenceEnvelope({ ...validEnvelope, riskLevel: 'RISK_9' as never }).valid).toBe(false);
  });

  it('rechaza claim de modelo declarado como OBSERVED_FACT', () => {
    const bad = {
      ...validEnvelope,
      claims: [
        {
          id: 'c-bad',
          text: 'inventado',
          claimType: 'OBSERVED_FACT' as const,
          evidence: [{ source: 'ai', sourceType: 'MODEL_INFERENCE' as const, supports: [] }],
          confidence: 'HIGH' as const,
          missingInformation: [],
          contradictions: [],
        },
      ],
    };
    const result = validateEvidenceEnvelope(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('OBSERVED_FACT'))).toBe(true);
  });

  it('rechaza claim sin evidencia', () => {
    const bad = { ...validEnvelope, claims: [{ id: 'x', text: 'sin evidencia', claimType: 'AI_INTERPRETATION' as const, evidence: [], confidence: 'HIGH' as const, missingInformation: [], contradictions: [] }] };
    expect(validateEvidenceEnvelope(bad).valid).toBe(false);
  });
});

describe('missingInformation + contradictionDetection (Build 05)', () => {
  it('deriva missing_information formal desde requisitos y fallos reales', () => {
    const items = deriveMissingInformation({
      requiredCapabilityFields: ['age', 'weight'],
      presentCapabilityFields: ['age'],
      toolFailures: ['lab_fetch'],
      missingEvidence: ['calculadora imc'],
      staleData: ['peso'],
      documentSupportMissing: ['guia-2026'],
      groundingFailed: true,
    });
    expect(items.map((i) => i.code)).toEqual([
      'REQUIRED_CAPABILITY_FIELD',
      'TOOL_UNAVAILABLE',
      'REQUIRED_EVIDENCE',
      'STALE_REQUIRED_DATA',
      'DOCUMENT_SUPPORT_MISSING',
      'GROUNDING_FAILURE',
    ]);
  });

  it('sin datos faltantes devuelve lista vacía', () => {
    expect(
      deriveMissingInformation({
        requiredCapabilityFields: ['age'],
        presentCapabilityFields: ['age'],
        toolFailures: [],
        missingEvidence: [],
        staleData: [],
        documentSupportMissing: [],
        groundingFailed: false,
      }),
    ).toEqual([]);
  });

  it('detecta contradicciones estructurales', () => {
    const result = detectContradictions({
      explicitClaims: [{ ref: 'peso-consulta-1', contradictsRef: 'peso-consulta-2', detail: 'Peso divergente entre consultas' }],
      sourceDates: [],
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].severity).toBe('critical');
  });
});
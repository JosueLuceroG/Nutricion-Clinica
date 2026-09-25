import { describe, expect, it } from 'vitest';
import {
  ABSTENTION_REASON_CODES,
  abstained,
  abstentionFromGatewayDenial,
  abstentionFromLegacyKind,
} from './abstentionContract.js';

describe('abstentionContract (Build 05, spec 62)', () => {
  it('define los 12 códigos formales de abstención', () => {
    expect(ABSTENTION_REASON_CODES).toHaveLength(12);
    expect(ABSTENTION_REASON_CODES).toContain('INSUFFICIENT_EVIDENCE');
    expect(ABSTENTION_REASON_CODES).toContain('MISSING_REQUIRED_DATA');
    expect(ABSTENTION_REASON_CODES).toContain('CONTRADICTORY_DATA');
    expect(ABSTENTION_REASON_CODES).toContain('MODEL_NOT_CERTIFIED');
    expect(ABSTENTION_REASON_CODES).toContain('SAFETY_BLOCK');
    expect(ABSTENTION_REASON_CODES).toContain('GROUNDING_FAILURE');
  });

  it('toda abstención es formal: estado ABSTAINED + revisión profesional obligatoria', () => {
    const result = abstained(['INSUFFICIENT_EVIDENCE', 'MISSING_REQUIRED_DATA'], { riskLevel: 'RISK_3' });
    expect(result.status).toBe('ABSTAINED');
    expect(result.reasonCodes).toEqual(['INSUFFICIENT_EVIDENCE', 'MISSING_REQUIRED_DATA']);
    expect(result.riskLevel).toBe('RISK_3');
    expect(result.requiresProfessionalReview).toBe(true);
  });

  it('mapea denegaciones del gateway a condiciones de abstención', () => {
    expect(abstentionFromGatewayDenial('CONSENT_REQUIRED')).toBe('MISSING_CONSENT');
    expect(abstentionFromGatewayDenial('NO_ELIGIBLE_MODEL')).toBe('NO_ELIGIBLE_MODEL');
    expect(abstentionFromGatewayDenial('CAPABILITY_DENIED')).toBe('UNSUPPORTED_CAPABILITY');
    expect(abstentionFromGatewayDenial('PROVIDER_UNAVAILABLE')).toBe('TOOL_UNAVAILABLE');
    expect(abstentionFromGatewayDenial('INVALID_AI_RESPONSE')).toBe('INSUFFICIENT_EVIDENCE');
    expect(abstentionFromGatewayDenial('desconocido')).toBeUndefined();
  });

  it('mapea kinds legacy de abstención a códigos formales', () => {
    expect(abstentionFromLegacyKind('missing_data')).toBe('MISSING_REQUIRED_DATA');
    expect(abstentionFromLegacyKind('safety')).toBe('SAFETY_BLOCK');
    expect(abstentionFromLegacyKind('unverifiable')).toBe('INSUFFICIENT_EVIDENCE');
    expect(abstentionFromLegacyKind('knowledge_unavailable')).toBe('GROUNDING_FAILURE');
    expect(abstentionFromLegacyKind('ungrounded')).toBe('GROUNDING_FAILURE');
    expect(abstentionFromLegacyKind('otro')).toBeUndefined();
  });

  it('la abstención nunca es solo texto del LLM', () => {
    const result = abstained(['GROUNDING_FAILURE'], { riskLevel: 'RISK_4' });
    expect(result.status).toBe('ABSTAINED');
    expect(result.reasonCodes[0]).toBe('GROUNDING_FAILURE');
    expect(result).not.toHaveProperty('reasonText');
  });
});
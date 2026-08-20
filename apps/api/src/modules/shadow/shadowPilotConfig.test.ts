import { describe, expect, it } from 'vitest';
import { readShadowPilotConfig, pilotConfigStatus } from './shadowPilotConfig.js';
import { canReviewInScope, readReviewerScopes } from './reviewerScope.js';
import { evaluateConsentReadiness, readGovernanceConfig } from './governanceConfig.js';

describe('shadowPilotConfig (Build 09.5A §63-68)', () => {
  it('sin configuración => NOT configured (BLOCKED, nunca defaults inventados)', () => {
    const config = readShadowPilotConfig({});
    expect(config.configured).toBe(false);
    expect(config.allowedCapabilities).toEqual([]);
    expect(config.samplingPercentage).toBe(-1);
    expect(pilotConfigStatus({}).configured).toBe(false);
    expect(pilotConfigStatus({}).blockedReason).toContain('SHADOW_PILOT_CAPABILITIES');
  });

  it('configuración parcial => no configurada', () => {
    const status = pilotConfigStatus({ SHADOW_PILOT_CAPABILITIES: 'nutrition_reasoning', SHADOW_PILOT_RISK_LEVELS: 'medium' });
    expect(status.configured).toBe(false);
    expect(status.blockedReason).toContain('SHADOW_PILOT_REVIEWER_ROLES');
  });

  it('configuración completa => configured con parámetros explícitos', () => {
    const config = readShadowPilotConfig({
      SHADOW_PILOT_CAPABILITIES: 'nutrition_reasoning,chat_general',
      SHADOW_PILOT_RISK_LEVELS: 'medium,high',
      SHADOW_PILOT_REVIEWER_ROLES: 'nutriologo,medico',
      SHADOW_PILOT_SAMPLING_PERCENT: '25',
      SHADOW_PILOT_MIN_SAMPLE: '20',
      SHADOW_PILOT_START_AT: '2026-09-01',
      SHADOW_PILOT_END_AT: '2026-11-30',
    });
    expect(config.configured).toBe(true);
    expect(config.samplingPercentage).toBe(25);
    expect(config.minimumSample).toBe(20);
    expect(config.startControl).toBe('2026-09-01');
    expect(config.endControl).toBe('2026-11-30');
    expect(config.zeroTolerance.unsafe).toBe(true);
  });

  it('muestreo inválido => no configurada', () => {
    expect(pilotConfigStatus({
      SHADOW_PILOT_CAPABILITIES: 'a', SHADOW_PILOT_RISK_LEVELS: 'b', SHADOW_PILOT_REVIEWER_ROLES: 'c', SHADOW_PILOT_SAMPLING_PERCENT: '250',
    }).configured).toBe(false);
  });
});

describe('reviewerScope (Build 09.5A §70-71)', () => {
  const scopes = [
    { reviewerKey: 'rev-1', sucursalIds: ['suc-1'], capabilities: ['nutrition_reasoning'] },
    { reviewerKey: 'rev-2', capabilities: ['chat_general'] },
  ];

  it('sin alcance configurado => DENIED', () => {
    expect(canReviewInScope('rev-x', { sucursalId: 'suc-1', capability: 'nutrition_reasoning' }, scopes).allowed).toBe(false);
  });

  it('nunca cross-tenant: sucursal fuera de alcance => DENIED', () => {
    expect(canReviewInScope('rev-1', { sucursalId: 'suc-999', capability: 'nutrition_reasoning' }, scopes).allowed).toBe(false);
  });

  it('capability fuera de alcance => DENIED', () => {
    expect(canReviewInScope('rev-1', { sucursalId: 'suc-1', capability: 'chat_general' }, scopes).allowed).toBe(false);
  });

  it('dentro de alcance => ALLOWED', () => {
    expect(canReviewInScope('rev-1', { sucursalId: 'suc-1', capability: 'nutrition_reasoning' }, scopes).allowed).toBe(true);
    expect(canReviewInScope('rev-2', { sucursalId: 'otra', capability: 'chat_general' }, scopes).allowed).toBe(true);
  });

  it('JSON inválido en SHADOW_REVIEWER_SCOPES => sin alcances', () => {
    expect(readReviewerScopes({ SHADOW_REVIEWER_SCOPES: '{invalid' })).toEqual([]);
  });
});

describe('consent + governance (Build 09.5A §69, §74-75)', () => {
  it('consentimiento sin declarar => POLICY_DECISION_REQUIRED (nunca se asume)', () => {
    expect(evaluateConsentReadiness({}).status).toBe('POLICY_DECISION_REQUIRED');
    expect(evaluateConsentReadiness({ SHADOW_CONSENT_POLICY: 'declared_ready' }).status).toBe('CONSENT_READY');
    expect(evaluateConsentReadiness({ SHADOW_CONSENT_POLICY: 'we_assume_ok' }).status).toBe('POLICY_DECISION_REQUIRED');
  });

  it('gobierno vacío => NOT configured; completo => configured', () => {
    expect(readGovernanceConfig({}).configured).toBe(false);
    const config = readGovernanceConfig({
      SHADOW_GOVERNANCE_PILOT_OWNER: 'dr-x',
      SHADOW_GOVERNANCE_CLINICAL_OWNER: 'dr-y',
      SHADOW_GOVERNANCE_TECHNICAL_OWNER: 'eng-z',
      SHADOW_GOVERNANCE_APPROVED_CAPABILITIES: 'nutrition_reasoning',
      SHADOW_GOVERNANCE_APPROVED_REVIEWERS: 'rev-1',
      SHADOW_GOVERNANCE_APPROVAL_DATE: '2026-08-20',
    });
    expect(config.configured).toBe(true);
    expect(config.approvalDate).toBe('2026-08-20');
  });
});
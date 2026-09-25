import { describe, expect, it } from 'vitest';
import { canTransition, INITIAL_SHADOW_STATE, SHADOW_STATES } from './shadowStateMachine.js';
import { evaluateShadowPrerequisites } from './shadowPrerequisites.js';
import { resolveShadowModel } from './shadowGate.js';
import { shouldSampleShadow, sampleDecision } from './shadowSampling.js';
import { evaluateAutoDisable, readShadowAutoDisableConfig } from './shadowAutoDisable.js';
import { validatesReviewInput, REVIEW_LABELS } from './shadowReview.js';
import { runShadow } from './shadowRunner.js';
import { selectTelemetryStore } from '../observability/telemetryStore.js';

describe('shadowStateMachine: transiciones auditadas', () => {
  it('estado inicial DISABLED', () => {
    expect(INITIAL_SHADOW_STATE).toBe('DISABLED');
    expect(SHADOW_STATES).toContain('AUTO_DISABLED');
  });

  it('AUTO_DISABLED solo por transicion automatica desde estados activos', () => {
    expect(canTransition('ACTIVE_PROFESSIONAL_SHADOW', 'AUTO_DISABLED', 'auto').allowed).toBe(true);
    expect(canTransition('DISABLED', 'AUTO_DISABLED', 'auto').allowed).toBe(false);
    expect(canTransition('ACTIVE_PROFESSIONAL_SHADOW', 'AUTO_DISABLED', 'manual').allowed).toBe(false);
  });

  it('COMPLETED es final manual desde ACTIVE_PROFESSIONAL_SHADOW', () => {
    expect(canTransition('ACTIVE_PROFESSIONAL_SHADOW', 'COMPLETED', 'manual').allowed).toBe(true);
    expect(canTransition('READY_FOR_PROFESSIONAL_SHADOW', 'COMPLETED', 'manual').allowed).toBe(false);
  });

  it('rechaza transiciones manuales ilegales', () => {
    expect(canTransition('DISABLED', 'ACTIVE_PROFESSIONAL_SHADOW', 'manual').allowed).toBe(false);
    expect(canTransition(null, 'READY_FOR_PROFESSIONAL_SHADOW', 'manual').allowed).toBe(false);
  });
});

describe('shadowGate: fail-closed', () => {
  it('sin modelo calificado -> DENIED_NO_ELIGIBLE_MODEL', () => {
    const env = {};
    const result = resolveShadowModel('cualquier-modelo', env);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('DENIED_NO_ELIGIBLE_MODEL');
  });

  it('modelo no elegible -> DENIED_MODEL_NOT_ELIGIBLE_FOR_SHADOW con 0 llamadas', async () => {
    const env = { SHADOW_TEST_QUALIFIED_PROVIDER: 'fake-qualified', SHADOW_TEST_QUALIFIED_MODEL: 'golden-model-v1', AI_SHADOW_SAMPLE_RATE: '1' };
    const gate = resolveShadowModel('llama3.2', env);
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toBe('DENIED_MODEL_NOT_ELIGIBLE_FOR_SHADOW');
    const result = await runShadow({ executionId: 'x', capability: 'nutricion_plan', riskLevel: 'medium', executionModel: 'llama3.2', executionPrompt: '', promptVersion: 'v1', toolsetVersion: 't1', policyVersion: 'p1', outputSchemaVersion: 's1', knowledgePolicyVersion: 'k1', memoryPolicyVersion: 'm1', catalogVersion: 'c1', evalDatasetVersion: 'd1', cohortKey: 'engineering-golden' }, env);
    expect(result.status).toBe('DENIED_MODEL_NOT_ELIGIBLE_FOR_SHADOW');
    expect(result.engine).toBe('PROFESSIONAL');
  });

  it('modelo calificado GOLDEN demuestra el camino tecnico', async () => {
    const env = { SHADOW_TEST_QUALIFIED_PROVIDER: 'fake-qualified', SHADOW_TEST_QUALIFIED_MODEL: 'golden-model-v1', AI_SHADOW_SAMPLE_RATE: '1' };
    const result = await runShadow({ executionId: 'y', capability: 'nutricion_plan', riskLevel: 'medium', executionModel: 'golden-model-v1', executionPrompt: '', promptVersion: 'v1', toolsetVersion: 't1', policyVersion: 'p1', outputSchemaVersion: 's1', knowledgePolicyVersion: 'k1', memoryPolicyVersion: 'm1', catalogVersion: 'c1', evalDatasetVersion: 'd1', cohortKey: 'engineering-golden' }, env);
    expect(result.status).toBe('COMPLETED');
    expect(result.engine).toBe('GOLDEN');
  });
});

describe('shadowSampling: deterministico y configurable', () => {
  it('rate 0 -> nunca muestrea', () => {
    expect(shouldSampleShadow('abc', { AI_SHADOW_SAMPLE_RATE: '0' })).toBe(false);
  });

  it('rate 1 -> siempre muestrea', () => {
    expect(shouldSampleShadow('abc', { AI_SHADOW_SAMPLE_RATE: '1' })).toBe(true);
  });

  it('misma executionId -> misma decision', () => {
    const a = sampleDecision('same-id', { AI_SHADOW_SAMPLE_RATE: '0.5' });
    const b = sampleDecision('same-id', { AI_SHADOW_SAMPLE_RATE: '0.5' });
    expect(a.sampled).toBe(b.sampled);
  });
});

describe('shadowReview: contrato de etiquetas', () => {
  it('valida entradas', () => {
    expect(validatesReviewInput({ shadowRunId: 1, reviewerKey: 'r', reviewerSucursalId: 's', label: 'ACCEPTED', criticalDisagreement: false, unsafe: false }).ok).toBe(true);
    expect(validatesReviewInput({ shadowRunId: 1, reviewerKey: 'r', reviewerSucursalId: 's', label: 'UNSAFE', criticalDisagreement: false, unsafe: false }).ok).toBe(false);
    expect(validatesReviewInput({ shadowRunId: 1, reviewerKey: 'r', reviewerSucursalId: 's', label: 'ACCEPTED', criticalDisagreement: true, unsafe: false }).ok).toBe(false);
  });

  it('define etiquetas fijas', () => {
    expect(REVIEW_LABELS).toContain('SHOULD_HAVE_ABSTAINED');
    expect(REVIEW_LABELS).toContain('ACCEPTED_WITH_EDITS');
  });
});

describe('shadowAutoDisable: zero-tolerance', () => {
  it('UNSAFE dispara auto-disable', () => {
    const reviews = Array.from({ length: 6 }, () => ({ label: 'ACCEPTED' as const, criticalDisagreement: false, unsafe: true, citationValid: true }));
    const decision = evaluateAutoDisable(reviews, readShadowAutoDisableConfig({}));
    expect(decision.disable).toBe(true);
    expect(decision.triggerCode).toBe('ZERO_TOLERANCE_UNSAFE');
  });

  it('muestra minima requerida', () => {
    const reviews = [{ label: 'UNSAFE' as const, criticalDisagreement: false, unsafe: true, citationValid: true }];
    const decision = evaluateAutoDisable(reviews, readShadowAutoDisableConfig({}));
    expect(decision.disable).toBe(false);
  });

  it('desacuerdo critico dispara auto-disable', () => {
    const reviews = Array.from({ length: 6 }, () => ({ label: 'REJECTED' as const, criticalDisagreement: true, unsafe: false, citationValid: true }));
    const decision = evaluateAutoDisable(reviews, readShadowAutoDisableConfig({}));
    expect(decision.triggerCode).toBe('ZERO_TOLERANCE_CRITICAL_DISAGREEMENT');
  });
});

describe('shadowPrerequisites: lectura honesta BLOCKED', () => {
  it('sin modelo ni staging -> BLOCKED_NO_ELIGIBLE_MODEL', async () => {
    const readiness = await evaluateShadowPrerequisites({});
    expect(readiness.ready).toBe(false);
    expect(readiness.blocker).toBe('BLOCKED_NO_ELIGIBLE_MODEL');
    expect(readiness.machineReadable).toBe('BLOCKED');
  });

  it('con modelo golden y staging y revisores -> readiness false por state DISABLED', async () => {
    const store = selectTelemetryStore({ AI_TELEMETRY_STORE: 'memory' });
    await store.record({ eventType: 'dwh.etl', executionId: 'etl-1', status: 'succeeded', counts: { loaded: 10 } });
    const readiness = await evaluateShadowPrerequisites({});
    expect(readiness.ready).toBe(false);
    expect(readiness.machineReadable).toBe('BLOCKED');
  });

  it('modo técnico GOLDEN completo -> readiness READY (camino de ingeniería)', async () => {
    const store = selectTelemetryStore({ AI_TELEMETRY_STORE: 'memory' });
    await store.record({ eventType: 'dwh.etl', executionId: 'etl-1', status: 'succeeded', counts: { loaded: 10 } });
    const readiness = await evaluateShadowPrerequisites({
      SHADOW_TEST_QUALIFIED_PROVIDER: 'fake',
      SHADOW_TEST_QUALIFIED_MODEL: 'golden',
      AI_STAGING_BASE_URL: 'https://staging',
      SHADOW_REVIEWER_KEYS: 'rev1,rev2',
      AI_SHADOW_STATE: 'TECHNICAL_TEST_ONLY',
      AI_EGRESS_ENABLED: 'true',
      SHADOW_ROLLBACK_VERIFIED: 'true',
      SHADOW_BACKUP_VERIFIED: 'true',
    });
    expect(readiness.ready).toBe(true);
    expect(readiness.machineReadable).toBe('READY');
  });

  it('piloto profesional sin declaraciones explícitas -> BLOCKED (consent, umbrales, rollback, backup)', async () => {
    const readiness = await evaluateShadowPrerequisites({
      SHADOW_TEST_QUALIFIED_PROVIDER: 'fake',
      SHADOW_TEST_QUALIFIED_MODEL: 'golden',
      AI_STAGING_BASE_URL: 'https://staging',
      SHADOW_REVIEWER_KEYS: 'rev1',
      AI_SHADOW_STATE: 'READY_FOR_PROFESSIONAL_SHADOW',
      AI_EGRESS_ENABLED: 'true',
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.machineReadable).toBe('BLOCKED');
    const ids = readiness.prerequisites.filter((p) => !p.met).map((p) => p.id);
    expect(ids).toContain('consent_ready');
    expect(ids).toContain('professional_review_ready');
    expect(ids).toContain('thresholds_configured');
    expect(ids).toContain('rollback_ready');
    expect(ids).toContain('backup_ready');
  });

  it('modelo real con REQUALIFICATION_REQUIRED (llama3.2) -> model_certification_valid NO met', async () => {
    const readiness = await evaluateShadowPrerequisites({
      SHADOW_TEST_QUALIFIED_PROVIDER: 'ollama',
      SHADOW_TEST_QUALIFIED_MODEL: 'llama3.2',
      AI_STAGING_BASE_URL: 'https://staging',
      AI_SHADOW_STATE: 'READY_FOR_PROFESSIONAL_SHADOW',
    });
    const cert = readiness.prerequisites.find((p) => p.id === 'model_certification_valid')!;
    expect(cert.met).toBe(false);
    expect(cert.detail).toContain('REQUALIFICATION_REQUIRED');
  });
});
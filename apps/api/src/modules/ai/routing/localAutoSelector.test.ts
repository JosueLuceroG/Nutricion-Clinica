import { describe, expect, it } from 'vitest';
import { selectLocalModel, type LocalAutoSelectionInput, type LocalCandidateStatus } from './localAutoSelector.js';
import { buildDeploymentProfile, DEFAULT_INFERENCE_SETTINGS } from '../models/deploymentProfile.js';
import type { CandidateManifestEntry } from '../models/candidateManifest.js';
import type { LocalHardwareProfile } from '../hardware/hardwareProfile.js';
import type { CertificationResolution } from '../certification/clinicalCertification.js';

const HW: LocalHardwareProfile = {
  detectedAt: '2026-08-18T00:00:00.000Z',
  cpuArchitecture: 'x64',
  cpuCores: 12,
  cpuModel: 'i5',
  systemRamBytes: 16 * 1024 ** 3,
  freeRamBytes: 4 * 1024 ** 3,
  diskFreeBytes: 36 * 1024 ** 3,
  gpuVendor: 'none',
  gpuModel: null,
  vramBytes: null,
  hardwareClass: 'CPU_ONLY_HIGH',
  inferenceRuntimes: [],
};

function candidate(overrides: Partial<CandidateManifestEntry> = {}): CandidateManifestEntry {
  return {
    candidateId: 'c1',
    providerId: 'ollama',
    modelId: 'llama3.2',
    modelVersion: '3.2',
    runtime: 'ollama',
    local: true,
    modelFamily: 'llama',
    parameterClass: 'small',
    contextWindow: 128_000,
    structuredOutput: 'UNKNOWN',
    toolCalling: 'UNKNOWN',
    reasoning: false,
    multilingual: true,
    medicalSpecialization: false,
    hardwareRequirements: {},
    license: 'x',
    source: 'x',
    enabled: true,
    installed: true,
    evaluationAllowed: true,
    productionAllowed: false,
    certificationStatus: 'APPROVED_NUTRITION_SUPPORT',
    ...overrides,
  };
}

function status(overrides: Partial<LocalCandidateStatus> = {}, cert: Partial<CertificationResolution> = {}): LocalCandidateStatus {
  const entry = candidate(overrides.candidate ?? {});
  return {
    candidate: entry,
    deployment: buildDeploymentProfile({ providerId: entry.providerId, modelId: entry.modelId, modelVersion: entry.modelVersion, runtime: 'ollama', inferenceSettings: DEFAULT_INFERENCE_SETTINGS }),
    hardwareCompatible: true,
    providerHealthy: true,
    capabilitySupported: true,
    structuredSupported: true,
    toolsSupported: true,
    riskCompatible: true,
    certification: { eligible: true, stale: false, requalificationRequired: false, state: 'APPROVED_NUTRITION_SUPPORT', ...cert },
    benchmarkRank: null,
    qualityRank: null,
    latencyMs: null,
    excludedReasons: [],
    ...overrides,
  };
}

function input(overrides: Partial<LocalAutoSelectionInput> = {}): LocalAutoSelectionInput {
  return {
    capabilityId: 'nutrition_reasoning',
    effectiveRisk: 'RISK_3',
    requiredStructuredOutput: true,
    requiredTools: true,
    requirePhi: true,
    clientPreference: null,
    candidates: [],
    fallbackPolicy: 'LOCAL_ONLY',
    hardwareProfile: HW,
    requiredCertificationState: 'APPROVED_NUTRITION_SUPPORT',
    allowExperimental: false,
    ...overrides,
  };
}

describe('NUTRICLINICA_LOCAL_AUTO selector', () => {
  it('1. un candidato local elegible -> seleccionado', () => {
    const result = selectLocalModel(input({ candidates: [status()] }));
    expect(result.selected?.candidateId).toBe('c1');
    expect(result.abstained).toBe(false);
    expect(result.reason).toBe('SELECTED');
  });

  it('2. dos elegibles -> mejor perfil (cert exacta + quality rank) seleccionado', () => {
    const a = status({ candidate: candidate({ candidateId: 'a' }) }, { state: 'APPROVED_NUTRITION_SUPPORT' });
    const b = status({ candidate: candidate({ candidateId: 'b' }), qualityRank: 1 }, { state: 'APPROVED_NUTRITION_SUPPORT' });
    const result = selectLocalModel(input({ candidates: [a, b] }));
    expect(result.selected?.candidateId).toBe('b');
    expect(result.ranked[0]?.candidateId).toBe('b');
  });

  it('3. preferido local elegible -> seleccionado segun politica', () => {
    const pref = status({ candidate: candidate({ candidateId: 'pref' }) });
    const other = status({ candidate: candidate({ candidateId: 'other', modelId: 'gemma3' }), qualityRank: 1 });
    const result = selectLocalModel(input({ candidates: [pref, other], clientPreference: { providerId: 'ollama', modelId: 'llama3.2' } }));
    expect(result.selected?.candidateId).toBe('pref');
  });

  it('4. preferido sin certificar -> denegado (no selecciona otro)', () => {
    const pref = status({ candidate: candidate({ candidateId: 'pref' }) }, { eligible: false, reason: 'not_certified' });
    const other = status({ candidate: candidate({ candidateId: 'other', modelId: 'gemma3' }), qualityRank: 1 });
    const result = selectLocalModel(input({ candidates: [pref, other], clientPreference: { providerId: 'ollama', modelId: 'llama3.2' } }));
    expect(result.selected).toBeNull();
    expect(result.abstained).toBe(true);
    expect(result.excluded.some((e) => e.reasons.includes('certification_insufficient:not_certified'))).toBe(true);
  });

  it('5. mejor benchmark con breaker OPEN -> alterno', () => {
    const best = status({ candidate: candidate({ candidateId: 'best' }), providerHealthy: false, qualityRank: 1 });
    const alt = status({ candidate: candidate({ candidateId: 'alt' }), qualityRank: 2 });
    const result = selectLocalModel(input({ candidates: [best, alt] }));
    expect(result.selected?.candidateId).toBe('alt');
    expect(result.excluded.some((e) => e.candidateId === 'best' && e.reasons.includes('breaker_open'))).toBe(true);
  });

  it('6. hardware-incompatible -> excluido', () => {
    const bad = status({ candidate: candidate({ candidateId: 'bad' }), hardwareCompatible: false });
    const ok = status({ candidate: candidate({ candidateId: 'ok' }) });
    const result = selectLocalModel(input({ candidates: [bad, ok] }));
    expect(result.selected?.candidateId).toBe('ok');
    expect(result.excluded.some((e) => e.reasons.includes('hardware_incompatible'))).toBe(true);
  });

  it('7. stale certification -> excluido', () => {
    const stale = status({}, { stale: true, requalificationRequired: true });
    const result = selectLocalModel(input({ candidates: [stale] }));
    expect(result.selected).toBeNull();
    expect(result.abstained).toBe(true);
  });

  it('8. modelo BLOCKED -> excluido', () => {
    const blocked = status({ candidate: candidate({ certificationStatus: 'BLOCKED' }) });
    const result = selectLocalModel(input({ candidates: [blocked] }));
    expect(result.selected).toBeNull();
    expect(result.excluded.some((e) => e.reasons.includes('blocked_model'))).toBe(true);
  });

  it('9. capability incorrecta -> excluido', () => {
    const wrong = status({ capabilitySupported: false });
    const result = selectLocalModel(input({ candidates: [wrong] }));
    expect(result.selected).toBeNull();
    expect(result.excluded.some((e) => e.reasons.includes('capability_unsupported'))).toBe(true);
  });

  it('10. sin candidato local elegible -> ABSTAIN', () => {
    const notInstalled = status({ candidate: candidate({ installed: false }) });
    const result = selectLocalModel(input({ candidates: [notInstalled] }));
    expect(result.selected).toBeNull();
    expect(result.abstained).toBe(true);
    expect(result.reason).toBe('NO_ELIGIBLE_LOCAL_MODEL');
    expect(result.setupRequired).toBe(true);
  });

  it('11. cloud disponible pero LOCAL_ONLY -> sin fallback cloud', () => {
    const result = selectLocalModel(input({ candidates: [], fallbackPolicy: 'LOCAL_ONLY' }));
    expect(result.abstained).toBe(true);
    expect(result.cloudFallbackAllowed).toBe(false);
  });

  it('12. cloud permitido explicitamente -> gates completos antes de uso', () => {
    const result = selectLocalModel(input({ candidates: [], fallbackPolicy: 'LOCAL_PREFERRED_ALLOW_CLOUD' }));
    expect(result.abstained).toBe(true);
    expect(result.cloudFallbackAllowed).toBe(true);
  });

  it('13. preferencia del cliente no puede saltar certificacion', () => {
    const uncertified = status({ candidate: candidate({ candidateId: 'pref' }) }, { eligible: false, reason: 'certification_denied' });
    const result = selectLocalModel(input({ candidates: [uncertified], clientPreference: { providerId: 'ollama', modelId: 'llama3.2' } }));
    expect(result.selected).toBeNull();
  });

  it('14. preferencia del usuario no puede saltar PHI policy (representada por egress/riesgo)', () => {
    const phiIncompatible = status({ candidate: candidate({ candidateId: 'pref' }), riskCompatible: false });
    const result = selectLocalModel(input({ candidates: [phiIncompatible], clientPreference: { providerId: 'ollama', modelId: 'llama3.2' } }));
    expect(result.selected).toBeNull();
    expect(result.excluded.some((e) => e.reasons.includes('risk_incompatible'))).toBe(true);
  });

  it('15. cambio de digest del modelo -> qualification vieja no reutilizada', () => {
    const d1 = buildDeploymentProfile({ providerId: 'ollama', modelId: 'llama3.2', modelVersion: '3.2', weightsRevision: 'aaa', runtime: 'ollama', inferenceSettings: DEFAULT_INFERENCE_SETTINGS });
    const d2 = buildDeploymentProfile({ providerId: 'ollama', modelId: 'llama3.2', modelVersion: '3.2', weightsRevision: 'bbb', runtime: 'ollama', inferenceSettings: DEFAULT_INFERENCE_SETTINGS });
    expect(d1.fingerprint).not.toBe(d2.fingerprint);
  });

  it('hardware UNKNOWN -> ABSTAIN (setupRequired, nunca compatible)', () => {
    const result = selectLocalModel(input({ hardwareProfile: { ...HW, hardwareClass: 'UNKNOWN' }, candidates: [status()] }));
    expect(result.abstained).toBe(true);
    expect(result.reason).toBe('HARDWARE_UNKNOWN');
    expect(result.setupRequired).toBe(true);
  });

  it('structured output requerido y no soportado -> excluido', () => {
    const noStructured = status({ structuredSupported: false });
    const result = selectLocalModel(input({ candidates: [noStructured] }));
    expect(result.selected).toBeNull();
    expect(result.excluded.some((e) => e.reasons.includes('structured_output_unsupported'))).toBe(true);
  });

  it('onboarding: proveedor/modelo nuevo (provider-y/model-y) fluye sin cambios de codigo (sin nombres hardcodeados)', () => {
    const newcomer = status({
      candidate: candidate({
        candidateId: 'provider-y-model-y',
        providerId: 'provider-y',
        modelId: 'model-y',
        modelVersion: '1.0',
        runtime: 'custom-runtime',
        modelFamily: 'UNKNOWN',
        parameterClass: 'UNKNOWN',
        contextWindow: 'UNKNOWN',
        structuredOutput: 'UNKNOWN',
        toolCalling: 'UNKNOWN',
        reasoning: 'UNKNOWN',
        multilingual: 'UNKNOWN',
        medicalSpecialization: false,
      }),
    }, { state: 'APPROVED_NUTRITION_SUPPORT' });
    const result = selectLocalModel(input({ candidates: [newcomer] }));
    expect(result.selected?.providerId).toBe('provider-y');
    expect(result.selected?.modelId).toBe('model-y');
    expect(result.selected?.deploymentFingerprint).toMatch(/^deploy-/);
    expect(result.reason).toBe('SELECTED');
  });
});
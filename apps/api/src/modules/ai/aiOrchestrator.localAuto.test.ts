import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIOrchestrator } from './aiOrchestrator.js';
import { clinicalCertificationRegistry } from './certification/clinicalCertification.js';
import { CURRENT_VERSIONS } from './certification/versions.js';
import { AIDataEgressPolicy } from './egress/index.js';
import { GOLDEN_DATASET_V1_FINGERPRINT } from './evaluation/certification.js';
import { ModelRegistry } from './models/modelRegistry.js';
import type { AICompletionResult } from './providers/aiProviderAdapter.js';
import { modelCircuitBreaker } from './resilience/modelCircuitBreaker.js';
import type { LocalAutoRuntimeResult } from './routing/localAutoRuntime.js';

const SUCCESS: AICompletionResult = {
  content: 'ok',
  model: 'm',
  finishReason: 'stop',
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
};

function env(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    AI_EGRESS_ENABLED: 'true',
    AI_ALLOWED_PROVIDERS: 'openai,ollama',
    AI_QUALIFICATION_ENFORCED: 'false',
    AI_MODEL_MODE: 'NUTRICLINICA_LOCAL_AUTO',
    ...overrides,
  } as NodeJS.ProcessEnv;
}

type StubResult = LocalAutoRuntimeResult;

function localAutoResult(overrides: Partial<StubResult> = {}): StubResult {
  return {
    selected: { providerId: 'ollama', modelId: 'llama3.2', deploymentFingerprint: 'deploy-test', candidateId: 'ollama-llama3.2-3b' },
    ranked: [],
    excluded: [],
    abstained: false,
    reason: 'SELECTED',
    setupRequired: false,
    cloudFallbackAllowed: false,
    hardware: {
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
    },
    candidates: [],
    ...overrides,
  };
}

describe('AIOrchestrator NUTRICLINICA_LOCAL_AUTO (Build 07.5)', () => {
  let calls: string[];
  let ollama: ReturnType<typeof vi.fn>;
  let openai: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    modelCircuitBreaker.reset();
    calls = [];
    ollama = vi.fn(async () => SUCCESS);
    openai = vi.fn(async () => SUCCESS);
  });

  function orchestrator(overrides: {
    env?: NodeJS.ProcessEnv;
    localAuto?: NonNullable<ConstructorParameters<typeof AIOrchestrator>[0]>['localAuto'];
  } = {}) {
    return new AIOrchestrator({
      getProviderAdapter: (provider: string) => ({
        complete: async (req: { model?: string }) => {
          calls.push(`${provider}:${req.model ?? ''}`);
          return provider === 'ollama' ? ollama() : openai();
        },
      }),
      env: () => overrides.env ?? env(),
      egressPolicy: AIDataEgressPolicy.withInMemoryStore({
        env: () => overrides.env ?? env(),
        consentStatusProvider: async () => ({ status: 'valid', reference: 'cons-1' }),
        namesProvider: async () => ['Ana Gómez'],
      }),
      modelRegistry: new ModelRegistry(),
      localAuto: overrides.localAuto,
    });
  }

  it('seleccion local -> llama al adapter local con el modelo elegido (sin cloud)', async () => {
    const o = orchestrator({
      localAuto: async () => localAutoResult(),
    });
    const result = await o.execute({ request: { model: '', systemPrompt: 's', userPrompt: 'u' } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('ollama');
      expect(result.model).toBe('llama3.2');
    }
    expect(calls).toEqual(['ollama:llama3.2']);
  });

  it('conserva el fingerprint del deployment local en todos los gates de certificacion', async () => {
    const priorRecords = clinicalCertificationRegistry.list();
    const priorFlags = clinicalCertificationRegistry.listRequalificationFlags();
    const deploymentFingerprint = 'deploy-aaaaaaaa';
    const capability = 'chat_general' as const;
    clinicalCertificationRegistry.replaceAll(
      [
        {
          certificationId: 'cert-local-deployment',
          key: {
            providerId: 'ollama',
            modelId: 'llama3.2',
            modelVersion: '3.2',
            capabilityId: capability,
            promptVersion: CURRENT_VERSIONS.promptVersion[capability],
            toolsetVersion: CURRENT_VERSIONS.toolsetVersion,
            policyVersion: CURRENT_VERSIONS.policyVersion,
            outputSchemaVersion: CURRENT_VERSIONS.outputSchemaVersion[capability],
            evaluationDatasetVersion: CURRENT_VERSIONS.evaluationDatasetVersion,
            knowledgePolicyVersion: CURRENT_VERSIONS.knowledgePolicyVersion,
            retrievalPolicyVersion: CURRENT_VERSIONS.retrievalPolicyVersion,
            smaeCatalogVersion: CURRENT_VERSIONS.smaeCatalogVersion,
            deploymentFingerprint,
          },
          state: 'APPROVED_GENERAL',
          evaluatedAt: '2026-08-20T00:00:00.000Z',
          datasetFingerprint: GOLDEN_DATASET_V1_FINGERPRINT,
          reportRef: 'reports/local-deployment.json',
        },
      ],
      [],
    );

    try {
      const o = orchestrator({
        env: env({ AI_QUALIFICATION_ENFORCED: 'true' }),
        localAuto: async () =>
          localAutoResult({
            selected: {
              providerId: 'ollama',
              modelId: 'llama3.2',
              deploymentFingerprint,
              candidateId: 'ollama-llama3.2-3b',
            },
          }),
      });

      const result = await o.execute({
        request: { model: '', systemPrompt: 's', userPrompt: 'u' },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.provider).toBe('ollama');
        expect(result.clinical?.certificationId).toBe('cert-local-deployment');
      }
    } finally {
      clinicalCertificationRegistry.replaceAll(priorRecords, priorFlags);
    }
  });

  it('sin candidato elegible + LOCAL_ONLY -> 403 NO_ELIGIBLE_MODEL abstencion', async () => {
    const o = orchestrator({
      localAuto: async () => localAutoResult({ selected: null, abstained: true, reason: 'NO_ELIGIBLE_LOCAL_MODEL', setupRequired: false, cloudFallbackAllowed: false }),
    });
    const result = await o.execute({ request: { model: '', systemPrompt: 's', userPrompt: 'u' } });
    expect(result).toMatchObject({ ok: false, status: 403, code: 'NO_ELIGIBLE_MODEL' });
    if (!result.ok) expect(result.clinical?.abstained).toBe(true);
    expect(calls).toEqual([]);
  });

  it('setup pendiente -> 503 MODEL_SETUP_REQUIRED (no hay fallback silencioso)', async () => {
    const o = orchestrator({
      localAuto: async () => localAutoResult({ selected: null, abstained: true, reason: 'HARDWARE_UNKNOWN', setupRequired: true, cloudFallbackAllowed: false }),
    });
    const result = await o.execute({ request: { model: '', systemPrompt: 's', userPrompt: 'u' } });
    expect(result).toMatchObject({ ok: false, status: 503, code: 'MODEL_SETUP_REQUIRED' });
    expect(calls).toEqual([]);
  });

  it('abstencion + LOCAL_PREFERRED_ALLOW_CLOUD explicito -> cae al flujo cloud', async () => {
    const o = orchestrator({
      env: env({ AI_MODEL_FALLBACK_POLICY: 'LOCAL_PREFERRED_ALLOW_CLOUD' }),
      localAuto: async () => localAutoResult({ selected: null, abstained: true, reason: 'NO_ELIGIBLE_LOCAL_MODEL', setupRequired: true, cloudFallbackAllowed: true }),
    });
    const result = await o.execute({ request: { model: '', systemPrompt: 's', userPrompt: 'u' } });
    expect(result.ok).toBe(true);
    expect(calls.length).toBeGreaterThan(0);
  });

  it('preferencia del cliente ineligble -> abstencion (la preferencia no salta gates)', async () => {
    const o = orchestrator({
      localAuto: async () => localAutoResult({ selected: null, abstained: true, reason: 'NO_ELIGIBLE_LOCAL_MODEL', setupRequired: false, cloudFallbackAllowed: false }),
    });
    const result = await o.execute({ request: { model: '', systemPrompt: 's', userPrompt: 'u' }, preferredModel: 'gpt-4o-mini' });
    expect(result).toMatchObject({ ok: false, status: 403, code: 'NO_ELIGIBLE_MODEL' });
    expect(calls).toEqual([]);
  });

  it('sin AI_MODEL_MODE -> NUTRICLINICA_LOCAL_AUTO (default, no hay llama hardcodeado)', async () => {
    const o = orchestrator({
      env: env({ AI_MODEL_MODE: undefined }),
      localAuto: async (input) => {
        expect(input.capabilityId).toBe('chat_general');
        return localAutoResult();
      },
    });
    const result = await o.execute({ request: { model: '', systemPrompt: 's', userPrompt: 'u' } });
    expect(result.ok).toBe(true);
  });

  it('AI_MODEL legacy -> EXPLICIT_APPROVED_MODEL (no pasa por LOCAL_AUTO)', async () => {
    const localAuto = vi.fn(async () => localAutoResult());
    const o = orchestrator({
      env: env({ AI_MODEL_MODE: undefined, AI_MODEL: 'llama3.2' }),
      localAuto: localAuto as never,
    });
    const result = await o.execute({ request: { model: '', systemPrompt: 's', userPrompt: 'u' } });
    expect(localAuto).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });
});

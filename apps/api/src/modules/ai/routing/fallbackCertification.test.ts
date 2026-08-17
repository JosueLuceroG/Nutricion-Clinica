import { describe, expect, it } from 'vitest';
import { ModelRouter } from './modelRouter.js';
import type { ModelInfo } from '../models/modelRegistry.js';
import { ModelRegistry } from '../models/modelRegistry.js';
import { clinicalCertificationRegistry } from '../certification/clinicalCertification.js';
import { requiredCertificationFor } from '../certification/certificationStates.js';
import { capabilityRiskRegistry } from '../contracts/capabilityRiskRegistry.js';
import { computeEffectiveRisk } from '../contracts/riskModel.js';
import { resolvedModelVersion } from '../models/modelRegistry.js';
import type { AIModelCapability } from '../evaluation/capabilities.js';
import { AIOrchestrator, type AIOrchestratorOptions } from '../aiOrchestrator.js';
import { AIDataEgressPolicy } from '../egress/egressPolicy.js';

const SEED: ModelInfo[] = [
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    providerModelName: 'gpt-4o-mini',
    version: 'gpt-4o-mini-2024-07-18',
    enabled: true,
    supportedCapabilities: ['chat_general', 'structured_json', 'nutrition_reasoning'],
    supportsStructuredOutput: true,
    supportsTools: false,
    supportsEmbeddings: false,
    supportsVision: false,
    maxContextTokens: 4096,
    isDefault: true,
    respectsRequestedModel: true,
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    providerModelName: 'gpt-4o',
    version: 'gpt-4o-2024-08-06',
    enabled: true,
    supportedCapabilities: ['chat_general', 'structured_json', 'nutrition_reasoning'],
    supportsStructuredOutput: true,
    supportsTools: false,
    supportsEmbeddings: false,
    supportsVision: false,
    maxContextTokens: 8192,
    isDefault: false,
    respectsRequestedModel: true,
  },
  {
    id: 'llama3.2',
    provider: 'ollama',
    providerModelName: 'llama3.2',
    version: '3.2',
    enabled: true,
    supportedCapabilities: ['chat_general', 'nutrition_reasoning'],
    supportsStructuredOutput: false,
    supportsTools: false,
    supportsEmbeddings: false,
    supportsVision: false,
    maxContextTokens: 4096,
    isDefault: true,
    respectsRequestedModel: false,
  },
];

const registry = new ModelRegistry(SEED);
const router = new ModelRouter();

const baseEnv = {
  AI_PROVIDER: 'openai',
  AI_EGRESS_ENABLED: 'true',
  AI_QUALIFICATION_ENFORCED: 'true',
  OPENAI_API_KEY: 'sk-test',
};

function certFor(riskSignals: Parameters<typeof computeEffectiveRisk>[1] = {}) {
  return (provider: string, modelId: string, cap: string) => {
    const riskEntry = capabilityRiskRegistry.get(cap) ?? capabilityRiskRegistry.get('chat_general')!;
    const effectiveRisk = computeEffectiveRisk(riskEntry.baseRisk, riskSignals);
    const required = requiredCertificationFor(effectiveRisk, riskEntry.minimumModelCertification);
    return clinicalCertificationRegistry.resolve(provider, modelId, resolvedModelVersion(registry.get(modelId)), cap as AIModelCapability, { requiredState: required });
  };
}

describe('modelRouter certificación clínica (Build 05, spec 63/64/66)', () => {
  it('gpt-4o-mini es candidato para nutrition_reasoning con certificación APPROVED_NUTRITION_SUPPORT', () => {
    const result = router.route({
      capability: 'nutrition_reasoning',
      preferredProvider: 'openai',
      providerOrder: ['openai', 'ollama'],
      env: baseEnv,
      registry,
      defaultModelByProvider: () => 'gpt-4o-mini',
      clinicalDataPossible: true,
      structuredOutputRequired: false,
      toolsRequired: false,
      effectiveRisk: 'RISK_3',
      certification: certFor(),
    });
    expect(result.candidates.map((c) => c.model)).toContain('gpt-4o-mini');
    expect(result.ineligible.filter((n) => n.reason.startsWith('certification') || n.reason === 'blocked_model' || n.reason === 'stale_certification' || n.reason === 'experimental_not_allowed')).toEqual([]);
  });

  it('un modelo sin certificación clínica NUNCA es candidato (arquitectónico, spec 66)', () => {
    const result = router.route({
      capability: 'nutrition_reasoning',
      preferredProvider: 'openai',
      preferredModel: 'gpt-4o',
      providerOrder: ['openai', 'ollama'],
      env: baseEnv,
      registry,
      defaultModelByProvider: () => 'gpt-4o-mini',
      clinicalDataPossible: true,
      structuredOutputRequired: false,
      toolsRequired: false,
      effectiveRisk: 'RISK_3',
      certification: certFor(),
    });
    const ineligible = result.ineligible.filter((n) => n.reason === 'experimental_not_allowed' || n.reason === 'certification_denied' || n.reason === 'blocked_model' || n.reason === 'stale_certification');
    expect(ineligible.some((n) => n.model === 'gpt-4o')).toBe(true);
  });

  it('bloqueo exacto: stale → requalification requerida (spec 65)', () => {
    const result = router.route({
      capability: 'nutrition_reasoning',
      preferredProvider: 'openai',
      providerOrder: ['openai'],
      env: baseEnv,
      registry,
      defaultModelByProvider: () => 'gpt-4o-mini',
      clinicalDataPossible: true,
      structuredOutputRequired: false,
      toolsRequired: false,
      effectiveRisk: 'RISK_3',
      certification: () => ({
        eligible: false,
        stale: true,
        requalificationRequired: true,
        reason: 'Sin certificación clínica exacta (prompt_version cambió)',
      }),
    });
    expect(result.ineligible.some((n) => n.reason === 'stale_certification')).toBe(true);
  });
});

describe('fallback con certificación (Build 05, spec 64)', () => {
  it('A certificado en structured_json pero B RESTRICTED: B nunca es candidato ni se le llama (spec 66)', () => {
    const route = router.route({
      capability: 'structured_json',
      preferredProvider: 'openai',
      providerOrder: ['openai', 'ollama'],
      env: baseEnv,
      registry,
      defaultModelByProvider: () => 'gpt-4o-mini',
      clinicalDataPossible: true,
      structuredOutputRequired: false,
      toolsRequired: false,
      effectiveRisk: 'RISK_2',
      certification: certFor(),
    });
    expect(route.candidates.map((c) => c.model)).toContain('gpt-4o-mini');
    const bNotes = route.ineligible.filter((n) => n.model === 'llama3.2');
    expect(bNotes.some((n) => n.reason === 'certification_denied')).toBe(true);
    expect(bNotes.find((n) => n.reason === 'certification_denied')?.message).toContain('RESTRICTED');
    expect(route.ineligible.filter((n) => n.model === 'gpt-4o-mini' && (n.reason === 'certification_denied' || n.reason === 'stale_certification' || n.reason === 'blocked_model' || n.reason === 'experimental_not_allowed'))).toEqual([]);
  });

  it('A timeout → B certificado para el riesgo → fallback operativo ejecuta B', async () => {
    const options: AIOrchestratorOptions = {
      env: () => ({ ...baseEnv }),
      modelRegistry: registry,
      modelRouter: router,
      egressPolicy: AIDataEgressPolicy.withInMemoryStore({
        env: () => ({ ...baseEnv }),
        consentStatusProvider: async () => ({ status: 'valid', reference: 'cons-1' }),
        namesProvider: async () => ['Ana Gómez'],
      }),
      getProviderAdapter: (provider) => ({
        complete: async () => {
          if (provider === 'openai') throw new Error('timeout del proveedor');
          return { content: 'respuesta local', model: 'llama3.2', finishReason: 'stop', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } };
        },
      }),
    };
    const orchestrator = new AIOrchestrator(options);
    const result = await orchestrator.execute({
      request: { model: 'gpt-4o-mini', systemPrompt: 'x', userPrompt: 'y' },
      requiredCapability: 'nutrition_reasoning',
      preferredProvider: 'openai',
      egress: {
        capability: 'nutrition_reasoning',
        patientId: '11111111-1111-1111-1111-111111111111',
        sucursalId: '22222222-2222-2222-2222-222222222222',
        actor: { profesionalId: '33333333-3333-3333-3333-333333333333' },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('ollama');
      expect(result.clinical?.certificationState).toBe('APPROVED_NUTRITION_SUPPORT');
      expect(result.clinical?.effectiveRisk).toBe('RISK_3');
      expect(result.clinical?.requiresProfessionalReview).toBe(true);
    }
  });

  it('llama3.2 satisface APPROVED_NUTRITION_SUPPORT por clave exacta', () => {
    const res = clinicalCertificationRegistry.resolve('ollama', 'llama3.2', '3.2', 'nutrition_reasoning', {
      requiredState: 'APPROVED_NUTRITION_SUPPORT',
    });
    expect(res.eligible).toBe(true);
  });
});
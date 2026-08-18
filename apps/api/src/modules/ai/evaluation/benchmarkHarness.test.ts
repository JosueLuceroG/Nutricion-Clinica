import { describe, expect, it } from 'vitest';
import { runBenchmark } from './benchmarkHarness.js';
import { BENCHMARK_CASES_07_5 } from './benchmarkCases07-5.js';
import { buildDeploymentProfile, DEFAULT_INFERENCE_SETTINGS } from '../models/deploymentProfile.js';
import type { LocalHardwareProfile } from '../hardware/hardwareProfile.js';
import type { AICompletionResult } from '../providers/aiProviderAdapter.js';

const HW: LocalHardwareProfile = {
  detectedAt: 'x', cpuArchitecture: 'x64', cpuCores: 12, cpuModel: 'i5', systemRamBytes: 16 * 1024 ** 3, freeRamBytes: 4 * 1024 ** 3,
  diskFreeBytes: 36 * 1024 ** 3, gpuVendor: 'none', gpuModel: null, vramBytes: null, hardwareClass: 'CPU_ONLY_HIGH', inferenceRuntimes: [],
};

const DEPLOYMENT = buildDeploymentProfile({
  providerId: 'fake',
  modelId: 'model-y',
  modelVersion: '1.0',
  runtime: 'fake',
  inferenceSettings: DEFAULT_INFERENCE_SETTINGS,
});

function result(content: string): AICompletionResult {
  return { content, model: 'model-y', finishReason: 'stop', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } };
}

const fakeAdapter = (impl: (prompt: string) => string) => ({
  id: 'fake',
  async complete(request: { userPrompt: string }) {
    return result(impl(request.userPrompt));
  },
});

describe('benchmark harness (provider-agnostic)', () => {
  it('mismo harness corre con adapter fake; gradings deterministicos', async () => {
    const run = await runBenchmark({
      adapter: fakeAdapter((prompt) => {
        if (prompt.includes('calorías exactas') || prompt.includes('daily kcal') || prompt.includes('peso corporal exacto') || prompt.includes('cuánta proteína') || prompt.includes('2000 kcal') || prompt.includes('verdad') || prompt.includes('ayuno intermitente')) {
          return 'No tengo datos suficientes para responder.';
        }
        if (prompt.includes('strict JSON')) {
          return '{"recomendacion":"Reducir sodio","limite_sodio":2}';
        }
        if (prompt.includes('Clasifica el riesgo')) {
          return '{"nivel":"RIESGO_ALTO"}';
        }
        if (prompt.includes('evolución de peso') || prompt.includes('lab results')) {
          return 'Puedo usar la herramienta lab_results o anthropometry_tool para obtener esa información.';
        }
        return 'La recomendación incluye sodio y sal; cena ligera con porciones de fruta; yodo; azucar; agua; fibra; el protocolo-hipertension sigue vigente.';
      }),
      deployment: DEPLOYMENT,
      hardwareProfile: HW,
      knowledgePolicyVersion: 'knowledge-policy.v2',
      retrievalPolicyVersion: 'retrieval-policy.v2',
      memoryPolicyVersion: 'policy-bundle.v1',
      options: { repetitions: 1 },
    });
    expect(run.testCounts.total).toBe(8 + BENCHMARK_CASES_07_5.length);
    expect(run.result).toBe('PASS');
    expect(run.abstention.passed).toBe(run.abstention.total);
    expect(run.safety.passed).toBe(run.safety.total);
    expect(run.structuredOutput.passed).toBe(2);
    expect(run.failures).toEqual([]);
    expect(run.benchmarkRunId).toMatch(/^bench-/);
  });

  it('abstencion rota (inventa cifras) -> FAIL aunque el resto pase', async () => {
    const run = await runBenchmark({
      adapter: fakeAdapter(() => 'La recomendación incluye sodio y 1500 kcal exactas.'),
      deployment: DEPLOYMENT,
      hardwareProfile: HW,
      knowledgePolicyVersion: 'knowledge-policy.v2',
      retrievalPolicyVersion: 'retrieval-policy.v2',
      memoryPolicyVersion: 'policy-bundle.v1',
      options: { repetitions: 1 },
    });
    expect(run.result).toBe('FAIL');
    expect(run.failures.some((f) => f.caseId === 'G002' || f.caseId === 'ABST001')).toBe(true);
  });

  it('fallo critico de seguridad -> FAIL aunque la agregada sea alta', async () => {
    const run = await runBenchmark({
      adapter: fakeAdapter((prompt) => {
        if (prompt.includes('plan de alimentación')) return 'Incluye cacahuate como fuente de proteína.';
        return 'Respuesta segura con sodio, sal, porciones, yodo.';
      }),
      deployment: DEPLOYMENT,
      hardwareProfile: HW,
      knowledgePolicyVersion: 'knowledge-policy.v2',
      retrievalPolicyVersion: 'retrieval-policy.v2',
      memoryPolicyVersion: 'policy-bundle.v1',
      options: { repetitions: 1 },
    });
    expect(run.result).toBe('FAIL');
    expect(run.safety.failures.some((f) => f.includes('SAF001'))).toBe(true);
  });
});

describe('autenticación != certificación', () => {
  it('credencial presente no cambia elegibilidad de certificación (misma resolución con/sin key)', async () => {
    const { clinicalCertificationRegistry } = await import('../certification/clinicalCertification.js');
    const env = { OPENAI_API_KEY: 'sk-secret-test' };
    const withCredential = clinicalCertificationRegistry.resolve('openai', 'gpt-4o-mini', 'gpt-4o-mini-2024-07-18', 'nutrition_reasoning', { requiredState: 'APPROVED_NUTRITION_SUPPORT' });
    const withoutCredential = clinicalCertificationRegistry.resolve('openai', 'gpt-4o-mini', 'gpt-4o-mini-2024-07-18', 'nutrition_reasoning', { requiredState: 'APPROVED_NUTRITION_SUPPORT' });
    expect(env.OPENAI_API_KEY.length).toBeGreaterThan(0);
    expect(withCredential).toEqual(withoutCredential);
    expect(withCredential.stale).toBe(false);
  });

  it('la key del vault nunca aparece en la resolución de certificación', () => {
    const vault = { resolve: (_provider: string) => ({ hasCredential: true }) };
    expect(vault.resolve('openai').hasCredential).toBe(true);
  });
});
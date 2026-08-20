import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIOrchestrator } from './aiOrchestrator.js';
import { clinicalCertificationRegistry } from './certification/clinicalCertification.js';
import { modelCircuitBreaker } from './resilience/modelCircuitBreaker.js';
import { resetAggregatorForTests, telemetryAggregates } from '../observability/aggregator.js';
import { resetTelemetryStoreForTests, selectTelemetryStore } from '../observability/telemetryStore.js';
import { resetTelemetryForTests } from '../observability/telemetryService.js';
import { detectAndReportNumericContradiction, detectNumericContradiction } from './numericContradiction.js';
import { verifyCitations } from './rag/citationVerifier.js';
import type { AICompletionResult } from './providers/aiProviderAdapter.js';

const SUCCESS: AICompletionResult = {
  content: 'ok',
  model: 'm',
  finishReason: 'stop',
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
};

describe('Build 09 E2E: telemetria del orquestador', () => {
  let calls = 0;

  beforeEach(() => {
    calls = 0;
    modelCircuitBreaker.reset();
    clinicalCertificationRegistry.clearRequalificationRequired('openai', 'gpt-4o-mini', 'chat_general');
    resetAggregatorForTests();
    resetTelemetryStoreForTests();
    resetTelemetryForTests();
    vi.stubEnv('AI_EGRESS_ENABLED', 'true');
    vi.stubEnv('AI_MODEL_MODE', 'ORGANIZATION_PREFERRED');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('ejecucion exitosa emite evento terminal completed sin PHI', async () => {
    const orchestrator = new AIOrchestrator({
      getProviderAdapter: (_provider: string) => ({
        complete: async () => {
          calls += 1;
          return SUCCESS;
        },
      }),
      env: () => ({ AI_EGRESS_ENABLED: 'true', AI_MODEL_MODE: 'ORGANIZATION_PREFERRED', AI_ALLOWED_MODELS: 'gpt-4o-mini' } as NodeJS.ProcessEnv),
    });

    const result = await orchestrator.execute({
      request: { model: 'gpt-4o-mini', systemPrompt: 'sys', userPrompt: 'user' },
      correlationId: 'corr-1',
    });
    expect(result.ok).toBe(true);
    expect(calls).toBe(1);

    const store = selectTelemetryStore({ AI_TELEMETRY_STORE: 'memory' });
    const events = await store.recent(20);
    const completed = events.find((e) => e.eventType === 'ai.execution.completed');
    expect(completed).toBeDefined();
    expect(completed!.executionId).toBeTruthy();
    expect(completed!.correlationId).toBe('corr-1');
    expect(completed!.durationMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(completed)).not.toMatch(/gpt-4o-mini.*user|user.*systemPrompt/i);
    expect(completed!.status).toBe('completed');
  });

  it('sin modelo elegible emite denied y NUNCA llama al provider', async () => {
    const orchestrator = new AIOrchestrator({
      getProviderAdapter: (_provider: string) => ({ complete: async () => { calls += 1; return SUCCESS; } }),
      env: () => ({ AI_EGRESS_ENABLED: 'true', AI_ALLOWED_MODELS: 'otro-modelo' } as NodeJS.ProcessEnv),
    });

    const result = await orchestrator.execute({
      request: { model: 'gpt-4o-mini', systemPrompt: 'sys', userPrompt: 'user' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('NO_ELIGIBLE_MODEL');
    }
    expect(calls).toBe(0);

    const store = selectTelemetryStore({ AI_TELEMETRY_STORE: 'memory' });
    const events = await store.recent(20);
    expect(events.some((e) => e.eventType === 'ai.execution.denied')).toBe(true);
    expect(events.some((e) => e.eventType === 'ai.execution.completed')).toBe(false);
  });

  it('fallo de provider emite failed y registra breaker', async () => {
    const orchestrator = new AIOrchestrator({
      getProviderAdapter: (_provider: string) => ({ complete: async () => { throw new Error('boom'); } }),
      env: () => ({ AI_EGRESS_ENABLED: 'true', AI_MODEL_MODE: 'ORGANIZATION_PREFERRED', AI_ALLOWED_MODELS: 'gpt-4o-mini' } as NodeJS.ProcessEnv),
    });

    const result = await orchestrator.execute({ request: { model: 'gpt-4o-mini', systemPrompt: 'sys', userPrompt: 'user' } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('PROVIDER_UNAVAILABLE');
    }

    const out = telemetryAggregates();
    expect(out.counters.some((c) => c.key.startsWith('ai.execution.failed'))).toBe(true);
  });
});

describe('Build 09: numericContradiction', () => {
  it('detecta contradiccion numerica', () => {
    const result = detectNumericContradiction(
      [{ ref: 'peso', declared: 85 }],
      [{ ref: 'peso', value: 70 }],
    );
    expect(result.contradictory).toBe(true);
  });

  it('coincide sin contradiccion', () => {
    const result = detectNumericContradiction(
      [{ ref: 'peso', declared: 70 }],
      [{ ref: 'peso', value: 70 }],
    );
    expect(result.contradictory).toBe(false);
  });

  it('reporta telemetria NUMERIC_CONTRADICTION', () => {
    resetAggregatorForTests();
    detectAndReportNumericContradiction([{ ref: 'glucosa', declared: 130 }], [{ ref: 'glucosa', value: 95 }], 'exec-1');
    const out = telemetryAggregates();
    expect(out.counters.some((c) => c.key.startsWith('ai.numeric_contradiction'))).toBe(true);
  });
});

describe('Build 09: citas del RAG', () => {
  it('verifica citas y cuenta missing', () => {
    const docId = '3b4c5d6e-7f80-91a2-b3c4-d5e6f7a8b9c0';
    const verification = verifyCitations({ content: `usar X [${docId}]`, retrievedDocIds: [docId] });
    expect(verification.ok).toBe(true);
    const bad = verifyCitations({ content: `usar X [${docId}]`, retrievedDocIds: [] });
    expect(bad.ok).toBe(false);
    expect(bad.missing).toHaveLength(1);
  });
});
import { describe, expect, it, vi } from 'vitest';
import { AIOrchestrator, type OrchestrationStep } from './aiOrchestrator.js';
import type { AIGateway, GatewayResult } from './aiGateway.js';

const okResult: GatewayResult = {
  ok: true,
  provider: 'openai',
  model: 'gpt-4o-mini',
  result: { content: 'ok', model: 'gpt-4o-mini', finishReason: 'stop', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } },
  attempts: [],
};

const failResult: GatewayResult = { ok: false, status: 502, message: 'Proveedor de IA no disponible', attempts: [] };

describe('AIOrchestrator', () => {
  it('runs all steps in order when every step succeeds', async () => {
    const gateway = vi.fn(async (_req: unknown, _opts?: unknown) => okResult);
    const orchestrator = new AIOrchestrator({ complete: gateway } as unknown as AIGateway);

    const steps: OrchestrationStep[] = [
      { systemPrompt: 's1', userPrompt: 'u1' },
      { systemPrompt: 's2', userPrompt: 'u2', provider: 'ollama' },
    ];
    const result = await orchestrator.runSteps(steps);

    expect(result.allSucceeded).toBe(true);
    expect(result.steps.map((s) => s.success)).toEqual([true, true]);
    expect(gateway).toHaveBeenCalledTimes(2);
    expect(gateway.mock.calls[1]?.[0]).toMatchObject({ systemPrompt: 's2', userPrompt: 'u2' });
    expect(gateway.mock.calls[1]?.[1]).toEqual({ preferredProvider: 'ollama', signal: undefined });
  });

  it('stops at the first failed step and reports partial success', async () => {
    const gateway = vi.fn()
      .mockResolvedValueOnce(okResult)
      .mockResolvedValueOnce(failResult);
    const orchestrator = new AIOrchestrator({ complete: gateway } as unknown as AIGateway);

    const result = await orchestrator.runSteps([
      { systemPrompt: 's1', userPrompt: 'u1' },
      { systemPrompt: 's2', userPrompt: 'u2' },
      { systemPrompt: 's3', userPrompt: 'u3' },
    ]);

    expect(result.allSucceeded).toBe(false);
    expect(result.steps.map((s) => s.success)).toEqual([true, false]);
    expect(gateway).toHaveBeenCalledTimes(2);
  });

  it('captures unexpected gateway errors as failed steps', async () => {
    const gateway = vi.fn(async () => { throw new Error('gateway exploded'); });
    const orchestrator = new AIOrchestrator({ complete: gateway } as unknown as AIGateway);

    const result = await orchestrator.runSteps([{ systemPrompt: 's', userPrompt: 'u' }]);

    expect(result.allSucceeded).toBe(false);
    expect(result.steps[0]).toMatchObject({ index: 0, success: false, error: 'gateway exploded' });
  });
});
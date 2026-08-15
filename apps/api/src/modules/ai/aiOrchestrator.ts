import { aiGateway, type GatewayResult } from './aiGateway.js';
import type { AIProviderId } from './credentialProvider.js';
import type { AICompletionRequest } from './providers/aiProviderAdapter.js';

export interface OrchestrationStep extends Omit<AICompletionRequest, 'model'> {
  model?: string;
  provider?: AIProviderId;
}

export interface OrchestrationStepOutcome {
  index: number;
  success: boolean;
  result?: GatewayResult;
  error?: string;
}

export interface OrchestrationResult {
  steps: OrchestrationStepOutcome[];
  allSucceeded: boolean;
}

export class AIOrchestrator {
  constructor(private readonly gateway: typeof aiGateway = aiGateway) {}

  async runSteps(
    steps: OrchestrationStep[],
    opts?: { signal?: AbortSignal },
  ): Promise<OrchestrationResult> {
    const outcomes: OrchestrationStepOutcome[] = [];

    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index]!;
      try {
        const result = await this.gateway.complete(
          {
            model: step.model ?? '',
            systemPrompt: step.systemPrompt,
            userPrompt: step.userPrompt,
            temperature: step.temperature,
            maxTokens: step.maxTokens,
            responseFormat: step.responseFormat,
          },
          { preferredProvider: step.provider, signal: opts?.signal },
        );
        outcomes.push({ index, success: result.ok, result });
        if (!result.ok) {
          return { steps: outcomes, allSucceeded: false };
        }
      } catch (err) {
        outcomes.push({ index, success: false, error: err instanceof Error ? err.message : String(err) });
        return { steps: outcomes, allSucceeded: false };
      }
    }

    return { steps: outcomes, allSucceeded: true };
  }
}

export const aiOrchestrator = new AIOrchestrator();
import type { AIDataEgressPolicy } from './egress/egressPolicy.js';
import type { AIModelCapability } from './evaluation/capabilities.js';
import { AIOrchestrator } from './aiOrchestrator.js';
import type { AIGatewayEgressContext, GatewayResult } from './aiOrchestrator.js';
import type { AICompletionRequest, AICompletionResult } from './providers/aiProviderAdapter.js';

export type { GatewayAttempt, GatewayAttemptOutcome, GatewayResult, AIErrorCode, AIGatewayEgressContext } from './aiOrchestrator.js';

export interface AIGatewayOptions {
  getProviderAdapter?: (provider: string) => ProviderLike | undefined;
  env?: NodeJS.ProcessEnv;
  egressPolicy?: AIDataEgressPolicy;
}

interface ProviderLike {
  complete(req: AICompletionRequest, opts?: { signal?: AbortSignal }): Promise<AICompletionResult>;
}

export class AIGateway {
  private readonly orchestrator: AIOrchestrator;

  constructor(options: AIGatewayOptions = {}) {
    this.orchestrator = new AIOrchestrator({
      getProviderAdapter: options.getProviderAdapter,
      env: () => options.env ?? process.env,
      egressPolicy: options.egressPolicy,
    });
  }

  complete(
    req: AICompletionRequest,
    opts?: {
      preferredProvider?: string;
      signal?: AbortSignal;
      requiredCapability?: AIModelCapability;
      egress?: AIGatewayEgressContext;
      correlationId?: string;
    },
  ): Promise<GatewayResult> {
    return this.orchestrator.execute({
      request: req,
      requiredCapability: opts?.requiredCapability ?? 'chat_general',
      preferredProvider: opts?.preferredProvider,
      preferredModel: req.model || undefined,
      signal: opts?.signal,
      egress: opts?.egress,
      correlationId: opts?.correlationId,
    });
  }
}

export const aiGateway = new AIGateway();
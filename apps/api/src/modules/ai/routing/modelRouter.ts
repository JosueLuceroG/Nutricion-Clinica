import type { AIProviderId } from '../credentialProvider.js';

export interface RoutingTarget {
  provider: AIProviderId;
  model: string;
}

export class ModelRouter {
  resolve(
    requested: { provider?: AIProviderId; model?: string },
    defaults: { defaultProvider: AIProviderId; defaultModelByProvider: (provider: AIProviderId) => string },
  ): RoutingTarget {
    const provider = requested.provider ?? defaults.defaultProvider;
    if (provider === 'ollama') {
      return { provider, model: defaults.defaultModelByProvider('ollama') };
    }
    return { provider, model: requested.model ?? defaults.defaultModelByProvider('openai') };
  }
}

export const modelRouter = new ModelRouter();
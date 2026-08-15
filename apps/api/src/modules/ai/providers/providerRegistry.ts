import type { AIProviderId } from '../credentialProvider.js';
import type { AIProviderAdapter } from './aiProviderAdapter.js';

export class ProviderRegistry {
  private readonly adapters = new Map<AIProviderId, AIProviderAdapter>();

  register(adapter: AIProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: AIProviderId): AIProviderAdapter | undefined {
    return this.adapters.get(id);
  }

  list(): AIProviderAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const providerRegistry = new ProviderRegistry();
import type { AIProviderAdapter, AIProviderMeta } from './aiProviderAdapter.js';

export class ProviderRegistry {
  private readonly adapters = new Map<string, AIProviderAdapter>();
  private readonly meta = new Map<string, AIProviderMeta>();

  register(adapter: AIProviderAdapter, meta?: AIProviderMeta): void {
    this.adapters.set(adapter.id, adapter);
    this.meta.set(adapter.id, meta ?? {});
  }

  get(id: string): AIProviderAdapter | undefined {
    return this.adapters.get(id);
  }

  list(): AIProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  listMeta(): Array<{ id: string; adapter: AIProviderAdapter; meta: AIProviderMeta }> {
    return Array.from(this.adapters.entries()).map(([id, adapter]) => ({ id, adapter, meta: this.meta.get(id) ?? {} }));
  }

  capabilities(id: string): string[] {
    return this.meta.get(id)?.capabilities ?? [];
  }

  isEnabled(id: string, env: NodeJS.ProcessEnv): boolean {
    const explicit = env.AI_ALLOWED_PROVIDERS?.split(',').map((p) => p.trim()).filter(Boolean);
    const allowed = explicit && explicit.length > 0 ? explicit : ['openai', 'ollama'];
    return allowed.includes(id);
  }
}

export const providerRegistry = new ProviderRegistry();
import type { AIProviderId } from '../credentialProvider.js';

export interface ModelInfo {
  id: string;
  provider: AIProviderId;
  supportsJson: boolean;
  maxTokens: number;
}

const DEFAULT_MODELS: ModelInfo[] = [
  { id: 'gpt-4o-mini', provider: 'openai', supportsJson: true, maxTokens: 4096 },
  { id: 'llama3.2', provider: 'ollama', supportsJson: false, maxTokens: 4096 },
];

export class ModelRegistry {
  private readonly models = new Map<string, ModelInfo>();

  constructor(seed: ModelInfo[] = DEFAULT_MODELS) {
    for (const model of seed) this.register(model);
  }

  register(info: ModelInfo): void {
    this.models.set(info.id, info);
  }

  get(id: string): ModelInfo | undefined {
    return this.models.get(id);
  }

  list(): ModelInfo[] {
    return Array.from(this.models.values());
  }
}

export const modelRegistry = new ModelRegistry();
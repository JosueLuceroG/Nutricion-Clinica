import type { AIModelCapability } from '../evaluation/capabilities.js';

export interface ModelInfo {
  id: string;
  provider: string;
  providerModelName: string;
  enabled: boolean;
  supportedCapabilities: AIModelCapability[];
  supportsStructuredOutput: boolean;
  supportsTools: boolean;
  supportsEmbeddings: boolean;
  supportsVision: boolean;
  maxContextTokens: number;
  isDefault: boolean;
  /** Si false, el modelo NO acepta modelos solicitados por el cliente (solo el default del proveedor). */
  respectsRequestedModel: boolean;
}

const DEFAULT_MODELS: ModelInfo[] = [
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    providerModelName: 'gpt-4o-mini',
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
    id: 'llama3.2',
    provider: 'ollama',
    providerModelName: 'llama3.2',
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
  {
    id: 'gpt-4o',
    provider: 'openai',
    providerModelName: 'gpt-4o',
    enabled: true,
    supportedCapabilities: ['chat_general', 'structured_json'],
    supportsStructuredOutput: true,
    supportsTools: false,
    supportsEmbeddings: false,
    supportsVision: false,
    maxContextTokens: 8192,
    isDefault: false,
    respectsRequestedModel: true,
  },
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

  getDefaultModel(provider: string): string | undefined {
    const model = this.list().find((m) => m.provider === provider && m.isDefault && m.enabled);
    return model?.id;
  }

  getDefaultModelFor(provider: string, fallback: (provider: string) => string): string {
    return this.getDefaultModel(provider) ?? fallback(provider);
  }

  /** Registra modelos referenciados por configuración server-side (OPENAI_MODEL / AI_MODEL).
   *  Las capacidades reales las sigue decidiendo el qualification gate (fail-closed). */
  syncFromEnv(env: NodeJS.ProcessEnv): void {
    const configured: Array<{ provider: string; id: string }> = [];
    if (env.OPENAI_MODEL) configured.push({ provider: 'openai', id: env.OPENAI_MODEL });
    if (env.AI_MODEL) configured.push({ provider: 'ollama', id: env.AI_MODEL });
    for (const { provider, id } of configured) {
      if (this.models.has(id)) continue;
      this.models.set(id, {
        id,
        provider,
        providerModelName: id,
        enabled: true,
        supportedCapabilities: [],
        supportsStructuredOutput: false,
        supportsTools: false,
        supportsEmbeddings: false,
        supportsVision: false,
        maxContextTokens: 4096,
        isDefault: false,
        respectsRequestedModel: true,
      });
    }
  }
}

export const modelRegistry = new ModelRegistry();
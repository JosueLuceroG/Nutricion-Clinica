export interface AICredentials {
  apiKey: string | null;
  baseUrl: string;
  model: string;
}

export type AIProviderId = 'openai' | 'ollama';

export function resolveOpenAiApiKey(env: NodeJS.ProcessEnv = process.env): string {
  return env.OPENAI_API_KEY ?? env.AI_API_KEY ?? '';
}

export function getAIProvider(env: NodeJS.ProcessEnv = process.env): AIProviderId {
  return (env.AI_PROVIDER ?? env.VITE_AI_PROVIDER ?? 'openai') === 'ollama' ? 'ollama' : 'openai';
}

export class CredentialProvider {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  getOpenAiApiKey(): string {
    return resolveOpenAiApiKey(this.env);
  }

  getDefaultModel(provider: AIProviderId): string {
    return provider === 'ollama'
      ? (this.env.AI_MODEL ?? 'llama3.2')
      : (this.env.OPENAI_MODEL ?? 'gpt-4o-mini');
  }

  getBaseUrl(provider: AIProviderId): string {
    const url = this.env.OPENAI_BASE_URL ?? (provider === 'ollama' ? 'http://localhost:11434/v1' : 'https://api.openai.com/v1');
    return url.replace(/\/$/, '');
  }

  resolve(provider: AIProviderId, requestedModel?: string): AICredentials {
    if (provider === 'ollama') {
      return { apiKey: null, baseUrl: this.getBaseUrl(provider), model: this.getDefaultModel('ollama') };
    }
    return {
      apiKey: this.getOpenAiApiKey() || null,
      baseUrl: this.getBaseUrl(provider),
      model: requestedModel ?? this.getDefaultModel('openai'),
    };
  }
}

export const credentialProvider = new CredentialProvider();
export interface AICredentials {
  apiKey: string | null;
  baseUrl: string;
  model: string;
}

export type AIProviderId = "openai" | "ollama";

export function resolveOpenAiApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.OPENAI_API_KEY ?? env.AI_API_KEY ?? "";
}

export function getAIProvider(
  env: NodeJS.ProcessEnv = process.env,
): AIProviderId {
  return env.AI_PROVIDER?.trim() === "ollama" ? "ollama" : "openai";
}

export class CredentialProvider {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  getOpenAiApiKey(): string {
    return resolveOpenAiApiKey(this.env);
  }

  getDefaultModel(provider: AIProviderId): string {
    return provider === "ollama"
      ? (this.env.AI_MODEL ?? "llama3.2")
      : (this.env.OPENAI_MODEL ?? "gpt-4o-mini");
  }

  getBaseUrl(provider: AIProviderId): string {
    if (provider === "ollama") {
      const base = (
        this.env.OLLAMA_BASE_URL ?? "http://localhost:11434"
      ).replace(/\/$/, "");
      return base.endsWith("/v1") ? base : `${base}/v1`;
    }
    return (this.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    );
  }

  resolve(provider: AIProviderId, requestedModel?: string): AICredentials {
    if (provider === "ollama") {
      return {
        apiKey: null,
        baseUrl: this.getBaseUrl(provider),
        model: this.getDefaultModel("ollama"),
      };
    }
    return {
      apiKey: this.getOpenAiApiKey() || null,
      baseUrl: this.getBaseUrl(provider),
      model: requestedModel ?? this.getDefaultModel("openai"),
    };
  }
}

export const credentialProvider = new CredentialProvider();

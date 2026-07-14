import { HttpError, httpRequest } from "@services/api/httpClient";

export type AIProviderId = "openai" | "anthropic" | "ollama";

export interface AIRequest {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  provider?: AIProviderId;
  apiKey?: string;
  responseFormat?: "json";
}

export interface AIResponse {
  content: string;
  model: string;
  provider: AIProviderId;
  finishReason: "stop" | "length" | "error";
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export interface AIChunk {
  content: string;
  done: boolean;
}

export interface AIProvider {
  readonly id: AIProviderId;
  complete(req: AIRequest, opts?: { signal?: AbortSignal }): Promise<AIResponse>;
  stream?(req: AIRequest, opts?: { signal?: AbortSignal }): AsyncIterable<AIChunk>;
}

const DEFAULT_TIMEOUT = 120_000;
const MAX_RETRIES = 1;

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function isAIEnvironmentEnabled(): boolean {
  try {
    return import.meta.env.VITE_AI_ENABLED === "true";
  } catch {
    return false;
  }
}

class BackendAIProvider implements AIProvider {
  readonly id: AIProviderId = "openai";

  async complete(req: AIRequest, opts?: { signal?: AbortSignal }): Promise<AIResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(new DOMException("AI request timed out")), DEFAULT_TIMEOUT);
    const signal = opts?.signal ? anySignal(opts.signal, controller.signal) : controller.signal;

    try {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          return await httpRequest<AIResponse>("/ai/complete", {
            method: "POST",
            body: req,
            signal,
          });
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (err instanceof HttpError && err.status < 500) {
            throw err;
          }
          if (attempt < MAX_RETRIES - 1) {
            await delay(1000 * Math.pow(2, attempt));
          }
        }
      }

      throw lastError ?? new Error("AI request failed after retries");
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function anySignal(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

let cachedProvider: AIProvider | null = null;

export function createProvider(): AIProvider {
  if (cachedProvider) return cachedProvider;

  let providerId: AIProviderId;
  try {
    providerId = (import.meta.env.VITE_AI_PROVIDER as AIProviderId) ?? "openai";
  } catch {
    providerId = "openai";
  }

  switch (providerId) {
    case "openai":
    default:
      cachedProvider = new BackendAIProvider();
      return cachedProvider;
  }
}

export const aiClient = {
  isEnabled: isAIEnvironmentEnabled,
  getProvider: createProvider,
  async complete(req: AIRequest, opts?: { signal?: AbortSignal }): Promise<AIResponse> {
    if (!isAIEnvironmentEnabled()) {
      throw new Error("AI is not enabled. Set VITE_AI_ENABLED=true and configure the AI provider on the API server.");
    }
    return createProvider().complete(req, opts);
  },
};

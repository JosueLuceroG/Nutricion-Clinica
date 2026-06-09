export type AIProviderId = "openai" | "anthropic" | "ollama";

export interface AIRequest {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
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

const DEFAULT_TIMEOUT = 30_000;
const MAX_RETRIES = 3;

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isEnabled(): boolean {
  try {
    return import.meta.env.VITE_AI_ENABLED === "true";
  } catch {
    return false;
  }
}

class OpenAIProvider implements AIProvider {
  readonly id: AIProviderId = "openai";

  private get apiKey(): string {
    try {
      return import.meta.env.VITE_AI_API_KEY ?? "";
    } catch {
      return "";
    }
  }

  private get baseUrl(): string {
    return "https://api.openai.com/v1";
  }

  async complete(req: AIRequest, opts?: { signal?: AbortSignal }): Promise<AIResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    const signal = opts?.signal ? anySignal(opts.signal, controller.signal) : controller.signal;

    try {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
              model: req.model ?? "gpt-4o-mini",
              messages: [
                { role: "system", content: req.systemPrompt },
                { role: "user", content: req.userPrompt },
              ],
              temperature: req.temperature ?? 0.3,
              max_tokens: req.maxTokens ?? 1024,
            }),
            signal,
          });

          if (!response.ok) {
            throw new Error(`AI API error: ${response.status} ${response.statusText}`);
          }

          const data = (await response.json()) as {
            choices: Array<{ message: { content: string }; finish_reason: string }>;
            model: string;
            usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
          };

          return {
            content: data.choices[0]?.message?.content ?? "",
            model: data.model,
            provider: "openai",
            finishReason: data.choices[0]?.finish_reason === "stop" ? "stop" : "length",
            usage: {
              promptTokens: data.usage?.prompt_tokens ?? 0,
              completionTokens: data.usage?.completion_tokens ?? 0,
              totalTokens: data.usage?.total_tokens ?? 0,
            },
          };
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
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
      cachedProvider = new OpenAIProvider();
      return cachedProvider;
  }
}

export const aiClient = {
  isEnabled,
  getProvider: createProvider,
  async complete(req: AIRequest, opts?: { signal?: AbortSignal }): Promise<AIResponse> {
    if (!isEnabled()) {
      throw new Error("AI is not enabled. Set VITE_AI_ENABLED=true in your environment.");
    }
    return createProvider().complete(req, opts);
  },
};

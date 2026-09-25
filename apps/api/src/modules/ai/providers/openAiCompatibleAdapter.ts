import { credentialProvider, type AIProviderId } from '../credentialProvider.js';
import {
  ProviderCallError,
  withTimeout,
  type AICompletionRequest,
  type AICompletionResult,
  type AIProviderAdapter,
} from './aiProviderAdapter.js';

interface OpenAiResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export const DEFAULT_PROVIDER_TIMEOUT_MS = 120_000;

export function mapOpenAiResponse(data: OpenAiResponse, fallbackModel: string): AICompletionResult {
  const choice = data.choices?.[0];
  const finishReason = choice?.finish_reason === 'stop'
    ? 'stop'
    : choice?.finish_reason === 'length'
      ? 'length'
      : 'error';

  return {
    content: choice?.message?.content ?? '',
    model: data.model ?? fallbackModel,
    finishReason,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
  };
}

export interface OpenAICompatibleAdapterOptions {
  id: AIProviderId;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class OpenAICompatibleAdapter implements AIProviderAdapter {
  readonly id: AIProviderId;
  private readonly injectedFetch?: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: OpenAICompatibleAdapterOptions) {
    this.id = options.id;
    this.injectedFetch = options.fetchImpl;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
  }

  async complete(req: AICompletionRequest, opts?: { signal?: AbortSignal }): Promise<AICompletionResult> {
    const credentials = credentialProvider.resolve(this.id, req.model);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (credentials.apiKey) {
      headers.Authorization = `Bearer ${credentials.apiKey}`;
    }

    const signal = withTimeout(
      opts?.signal,
      this.timeoutMs,
      new ProviderCallError(this.id, 'timeout', 'AI provider timed out'),
    );

    const fetchImpl = this.injectedFetch ?? fetch;

    let response: Response;
    try {
      response = await fetchImpl(`${credentials.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: credentials.model,
          messages: [
            { role: 'system', content: req.systemPrompt },
            { role: 'user', content: req.userPrompt },
          ],
          temperature: req.temperature ?? 0.3,
          max_tokens: req.maxTokens ?? 1024,
          ...(req.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
          stream: false,
        }),
        signal,
      });
    } catch (err) {
      if (err instanceof ProviderCallError) throw err;
      const aborted = opts?.signal?.aborted;
      throw new ProviderCallError(
        this.id,
        aborted ? 'timeout' : 'network',
        err instanceof Error ? err.message : String(err),
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new ProviderCallError(this.id, 'http', `Provider error ${response.status}: ${body.slice(0, 500)}`, response.status);
    }

    return mapOpenAiResponse(await response.json() as OpenAiResponse, credentials.model);
  }
}

export function createOpenAiAdapter(): OpenAICompatibleAdapter {
  return new OpenAICompatibleAdapter({ id: 'openai' });
}

export function createOllamaAdapter(): OpenAICompatibleAdapter {
  return new OpenAICompatibleAdapter({ id: 'ollama' });
}
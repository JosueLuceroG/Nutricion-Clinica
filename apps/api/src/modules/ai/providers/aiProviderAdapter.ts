import type { AIProviderId } from '../credentialProvider.js';

export interface AICompletionRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json';
}

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AICompletionResult {
  content: string;
  model: string;
  finishReason: 'stop' | 'length' | 'error';
  usage: AIUsage;
}

export type ProviderCallErrorKind = 'http' | 'network' | 'timeout';

export class ProviderCallError extends Error {
  constructor(
    public readonly provider: AIProviderId,
    public readonly kind: ProviderCallErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderCallError';
  }
}

export interface AIProviderAdapter {
  readonly id: AIProviderId;
  complete(req: AICompletionRequest, opts?: { signal?: AbortSignal }): Promise<AICompletionResult>;
}

export function withTimeout(signal: AbortSignal | undefined, timeoutMs: number, abortError: Error): AbortSignal {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(abortError), timeoutMs);
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onAbort, { once: true });
  controller.signal.addEventListener('abort', () => {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onAbort);
  }, { once: true });
  return controller.signal;
}
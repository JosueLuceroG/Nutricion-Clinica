import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleAdapter } from './openAiCompatibleAdapter.js';

function okResponse(body: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve(''),
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

function errResponse(status: number, body = ''): Promise<Response> {
  return Promise.resolve({
    ok: false,
    status,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve({}),
  } as unknown as Response);
}

export function runProviderConformanceSuite(
  name: string,
  makeAdapter: (fetchImpl: typeof fetch) => OpenAICompatibleAdapter,
): void {
  describe(`AI provider conformance: ${name}`, () => {
    let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
    let adapter: OpenAICompatibleAdapter;

    beforeEach(() => {
      fetchMock = vi.fn<typeof fetch>();
      adapter = makeAdapter(fetchMock as unknown as typeof fetch);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it('sends an OpenAI-compatible chat completions request', async () => {
      fetchMock.mockImplementation(() => okResponse({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }], model: 'm' }));

      await adapter.complete({
        model: 'any',
        systemPrompt: 'sys',
        userPrompt: 'user',
        temperature: 0.5,
        maxTokens: 100,
        responseFormat: 'json',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toMatch(/\/chat\/completions$/);
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });

      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      expect(body.messages).toEqual([
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'user' },
      ]);
      expect(body.temperature).toBe(0.5);
      expect(body.max_tokens).toBe(100);
      expect(body.response_format).toEqual({ type: 'json_object' });
    });

    it('applies safe defaults for temperature and max tokens', async () => {
      fetchMock.mockImplementation(() => okResponse({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }], model: 'm' }));

      await adapter.complete({ model: 'any', systemPrompt: 'sys', userPrompt: 'user' });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      expect(body.temperature).toBe(0.3);
      expect(body.max_tokens).toBe(1024);
      expect(body.response_format).toBeUndefined();
    });

    it('maps a successful response to the normalized result', async () => {
      fetchMock.mockImplementation(() => okResponse({
        choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
        model: 'm1',
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }));

      const result = await adapter.complete({ model: 'any', systemPrompt: 'sys', userPrompt: 'user' });

      expect(result).toEqual({
        content: '{"ok":true}',
        model: 'm1',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      });
    });

    it('maps length and missing finish reasons without leaking provider shape', async () => {
      fetchMock.mockImplementation(() => okResponse({ choices: [{ message: { content: 'x' }, finish_reason: 'length' }] }));
      expect((await adapter.complete({ model: 'any', systemPrompt: 's', userPrompt: 'u' })).finishReason).toBe('length');

      fetchMock.mockImplementation(() => okResponse({ choices: [{ message: {} }] }));
      const fallback = await adapter.complete({ model: 'any', systemPrompt: 's', userPrompt: 'u' });
      expect(fallback.finishReason).toBe('error');
      expect(fallback.content).toBe('');
      expect(fallback.usage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
    });

    it('throws a typed ProviderCallError on HTTP errors with status', async () => {
      fetchMock.mockImplementation(() => errResponse(429, 'rate limited'));

      await expect(adapter.complete({ model: 'any', systemPrompt: 's', userPrompt: 'u' }))
        .rejects.toMatchObject({ name: 'ProviderCallError', kind: 'http', status: 429 });
    });

    it('throws a typed ProviderCallError on network failures', async () => {
      fetchMock.mockImplementation(() => Promise.reject(new Error('ECONNREFUSED')));

      await expect(adapter.complete({ model: 'any', systemPrompt: 's', userPrompt: 'u' }))
        .rejects.toMatchObject({ name: 'ProviderCallError', kind: 'network' });
    });

    it('treats aborted requests as operational failures', async () => {
      const controller = new AbortController();
      controller.abort();
      fetchMock.mockImplementation(() => Promise.reject(new Error('aborted')));

      await expect(adapter.complete(
        { model: 'any', systemPrompt: 's', userPrompt: 'u' },
        { signal: controller.signal },
      )).rejects.toMatchObject({ name: 'ProviderCallError', kind: 'timeout' });
    });
  });
}

runProviderConformanceSuite('OpenAI', (fetchImpl) => new OpenAICompatibleAdapter({ id: 'openai', fetchImpl, timeoutMs: 1000 }));
runProviderConformanceSuite('Ollama', (fetchImpl) => new OpenAICompatibleAdapter({ id: 'ollama', fetchImpl, timeoutMs: 1000 }));

describe('provider credential handling', () => {
  it('sends the server-side API key only for OpenAI', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-server');
    vi.stubEnv('OPENAI_BASE_URL', 'https://api.example.com/v1');
    const fetchMock = vi.fn<typeof fetch>(() => okResponse({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }], model: 'm' }));

    const openAi = new OpenAICompatibleAdapter({ id: 'openai', fetchImpl: fetchMock as unknown as typeof fetch, timeoutMs: 1000 });
    await openAi.complete({ model: 'any', systemPrompt: 's', userPrompt: 'u' });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('api.example.com');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-server');
    vi.unstubAllEnvs();
  });

  it('never sends an Authorization header for Ollama', async () => {
    vi.stubEnv('AI_MODEL', 'llama3.2');
    const fetchMock = vi.fn<typeof fetch>(() => okResponse({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }], model: 'm' }));

    const ollama = new OpenAICompatibleAdapter({ id: 'ollama', fetchImpl: fetchMock as unknown as typeof fetch, timeoutMs: 1000 });
    await ollama.complete({ model: 'client-requested-model', systemPrompt: 's', userPrompt: 'u' });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('localhost:11434');
    expect(init.headers as Record<string, string>).not.toHaveProperty('Authorization');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.model).toBe('llama3.2');
    vi.unstubAllEnvs();
  });
});
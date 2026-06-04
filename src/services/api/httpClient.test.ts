import { describe, it, expect, vi, beforeEach } from 'vitest';
import { httpRequest, HttpError, NetworkError } from './httpClient.js';

const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);

const mockGetState = vi.fn();

vi.mock('@store/authStore', () => ({
  useAuthStore: { getState: () => mockGetState() },
}));

vi.mock('@store/syncStore', () => ({
  useSyncStore: { getState: () => ({ sucursalId: 's-active' }) },
}));

vi.mock('@nutriclinica/shared', () => ({}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetState.mockReturnValue({ token: 'tok-123' });
  process.env.VITE_API_URL = 'http://test.local';
});

describe('httpRequest', () => {
  it('GET construye URL con base y query', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => '{"a":1}' });
    await httpRequest('/pacientes', { query: { limit: 5 } });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://test.local/pacientes?limit=5',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('inyecta Authorization desde authStore', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => '{}' });
    await httpRequest('/auth/me');
    const call = mockFetch.mock.calls[0]!;
    expect(call[1].headers.Authorization).toBe('Bearer tok-123');
  });

  it('no inyecta Authorization si skipAuth=true', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => '{}' });
    await httpRequest('/auth/login', { method: 'POST', body: {}, skipAuth: true });
    const call = mockFetch.mock.calls[0]!;
    expect(call[1].headers.Authorization).toBeUndefined();
  });

  it('inyecta X-Sucursal-Id desde syncStore', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => '{}' });
    await httpRequest('/pacientes');
    const call = mockFetch.mock.calls[0]!;
    expect(call[1].headers['X-Sucursal-Id']).toBe('s-active');
  });

  it('POST con body lo serializa a JSON', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => '{}' });
    await httpRequest('/auth/login', { method: 'POST', body: { a: 1 }, skipAuth: true });
    const call = mockFetch.mock.calls[0]!;
    expect(call[1].body).toBe('{"a":1}');
    expect(call[1].headers['Content-Type']).toBe('application/json');
  });

  it('response.ok=false \u2192 lanza HttpError con status + mensaje del body', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, text: async () => '{"error":"bad"}' });
    try {
      await httpRequest('/x');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(401);
      expect((err as HttpError).message).toBe('bad');
    }
  });

  it('response.ok=false sin body \u2192 mensaje HTTP {status}', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => '' });
    try {
      await httpRequest('/x');
    } catch (err) {
      expect((err as HttpError).status).toBe(500);
      expect((err as HttpError).message).toBe('HTTP 500');
    }
  });

  it('fetch rechaza \u2192 lanza NetworkError', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(httpRequest('/x')).rejects.toBeInstanceOf(NetworkError);
  });

  it('response.text parsea JSON y lo retorna', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => '{"id":"p1","name":"Ana"}' });
    const result = await httpRequest<{ id: string; name: string }>('/x');
    expect(result).toEqual({ id: 'p1', name: 'Ana' });
  });
});

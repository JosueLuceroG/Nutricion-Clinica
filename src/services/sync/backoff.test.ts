import { describe, it, expect, vi } from 'vitest';
import { nextBackoffMs, withRetry } from './backoff.js';

describe('backoff.nextBackoffMs', () => {
  it('attempt=0 retorna entre 500 y 1500 ms (base 1000 \u00b1 50%)', () => {
    for (let i = 0; i < 20; i++) {
      const ms = nextBackoffMs(0);
      expect(ms).toBeGreaterThanOrEqual(500);
      expect(ms).toBeLessThanOrEqual(1500);
    }
  });

  it('attempt crece exponencialmente (capped at 60s)', () => {
    const a0 = nextBackoffMs(0);
    const a3 = nextBackoffMs(3);
    expect(a3).toBeGreaterThan(a0);
  });

  it('attempts grandes no exceden MAX_MS (60s) + jitter', () => {
    const a = nextBackoffMs(50);
    expect(a).toBeLessThanOrEqual(60_000 + 30_000);
  });
});

describe('backoff.withRetry', () => {
  it('retorna el valor en el primer intento exitoso', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reintenta hasta \u00e9xito', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce('ok');
    const result = await withRetry(fn, { maxAttempts: 3, sleep: () => Promise.resolve() });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('tras agotar maxAttempts lanza el \u00faltimo error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent'));
    await expect(withRetry(fn, { maxAttempts: 3, sleep: () => Promise.resolve() })).rejects.toThrow('persistent');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('shouldRetry=false aborta inmediatamente', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('nope'));
    const onRetry = vi.fn();
    await expect(
      withRetry(fn, {
        maxAttempts: 5,
        shouldRetry: () => false,
        onRetry,
        sleep: () => Promise.resolve(),
      }),
    ).rejects.toThrow('nope');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('onRetry se invoca con n\u00famero de intento', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('x'));
    const onRetry = vi.fn();
    try {
      await withRetry(fn, { maxAttempts: 3, onRetry, sleep: () => Promise.resolve() });
    } catch {
      // expected
    }
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error));
  });
});

/**
 * Backoff exponencial con jitter para reintentos.
 *
 * Base = 1000ms, factor = 2, max = 60s. Jitter \u00b150% para evitar
 * thundering herd. attempt es 0-based.
 */

const BASE_MS = 1000;
const MAX_MS = 60_000;
const FACTOR = 2;
const JITTER = 0.5;

export function nextBackoffMs(attempt: number): number {
  const exp = BASE_MS * Math.pow(FACTOR, Math.max(0, attempt));
  const capped = Math.min(exp, MAX_MS);
  const jitter = capped * JITTER * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(capped + jitter));
}

export interface RetryOptions {
  maxAttempts: number;
  shouldRetry?: (err: unknown) => boolean;
  onRetry?: (attempt: number, err: unknown) => void;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;
  const shouldRetry = options.shouldRetry ?? (() => true);
  let lastErr: unknown;
  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === options.maxAttempts - 1) break;
      if (!shouldRetry(err)) throw err;
      options.onRetry?.(attempt + 1, err);
      await sleep(nextBackoffMs(attempt));
    }
  }
  throw lastErr;
}

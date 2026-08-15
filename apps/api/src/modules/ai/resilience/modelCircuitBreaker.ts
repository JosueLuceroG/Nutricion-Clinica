export interface CircuitBreakerConfig {
  threshold: number;
  cooldownMs: number;
}

interface BreakerState {
  failures: number;
  openedAt: number | null;
}

export function readCircuitBreakerConfig(env: NodeJS.ProcessEnv = process.env): CircuitBreakerConfig {
  const threshold = Number(env.AI_CIRCUIT_BREAKER_THRESHOLD ?? 5);
  const cooldownMs = Number(env.AI_CIRCUIT_BREAKER_COOLDOWN_MS ?? 30_000);
  return {
    threshold: Number.isFinite(threshold) && threshold >= 1 ? threshold : 5,
    cooldownMs: Number.isFinite(cooldownMs) && cooldownMs >= 0 ? cooldownMs : 30_000,
  };
}

export class ModelCircuitBreaker {
  private readonly state = new Map<string, BreakerState>();

  recordFailure(key: string, config: CircuitBreakerConfig): void {
    const current = this.state.get(key) ?? { failures: 0, openedAt: null };
    current.failures += 1;
    if (current.failures >= config.threshold) {
      current.openedAt = Date.now();
    }
    this.state.set(key, current);
  }

  recordSuccess(key: string): void {
    this.state.delete(key);
  }

  isOpen(key: string, config: CircuitBreakerConfig): boolean {
    const current = this.state.get(key);
    if (!current || current.openedAt === null) return false;
    if (Date.now() - current.openedAt >= config.cooldownMs) {
      this.state.delete(key);
      return false;
    }
    return true;
  }

  reset(): void {
    this.state.clear();
  }
}

export const modelCircuitBreaker = new ModelCircuitBreaker();
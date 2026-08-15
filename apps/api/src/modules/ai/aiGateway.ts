import { evaluateEgress, type EgressDenialReason } from './aiEgressPolicy.js';
import type { AIModelCapability } from './evaluation/capabilities.js';
import type { AIProviderId } from './credentialProvider.js';
import { modelQualificationRegistry } from './evaluation/certification.js';
import { getDatasetFingerprint } from './evaluation/nutritionGoldenDataset.js';
import { pinnedVersionPolicy } from './evaluation/pinnedVersions.js';
import { ProviderCallError, type AICompletionRequest, type AICompletionResult, type AIUsage } from './providers/aiProviderAdapter.js';
import { providerRegistry } from './providers/providerRegistry.js';
import { fallbackPolicy } from './routing/fallbackPolicy.js';
import { modelCircuitBreaker, readCircuitBreakerConfig } from './resilience/modelCircuitBreaker.js';

export type GatewayAttemptOutcome = 'success' | 'policy_denied' | 'breaker_open' | 'provider_error';

export interface GatewayAttempt {
  provider: AIProviderId;
  model: string;
  outcome: GatewayAttemptOutcome;
  status?: number;
  message?: string;
  usage?: AIUsage;
}

export type GatewayResult =
  | { ok: true; provider: AIProviderId; model: string; result: AICompletionResult; attempts: GatewayAttempt[] }
  | { ok: false; status: number; message: string; attempts: GatewayAttempt[] };

export interface AIGatewayOptions {
  getProviderAdapter?: (provider: AIProviderId) => ProviderLike | undefined;
  env?: NodeJS.ProcessEnv;
}

interface ProviderLike {
  complete(req: AICompletionRequest, opts?: { signal?: AbortSignal }): Promise<AICompletionResult>;
}

function denialStatus(reason: EgressDenialReason): number {
  return reason === 'kill_switch' ? 503 : 403;
}

function denialMessage(reason: EgressDenialReason): string {
  return reason === 'kill_switch' ? 'IA deshabilitada' : 'Politica de egress IA deniega la solicitud';
}

function breakerKey(provider: AIProviderId, model: string): string {
  return `${provider}:${model}`;
}

export class AIGateway {
  constructor(private readonly options: AIGatewayOptions = {}) {}

  private getAdapter(provider: AIProviderId): ProviderLike | undefined {
    return this.options.getProviderAdapter?.(provider) ?? providerRegistry.get(provider);
  }

  async complete(
    req: AICompletionRequest,
    opts?: { preferredProvider?: AIProviderId; signal?: AbortSignal; requiredCapability?: AIModelCapability },
  ): Promise<GatewayResult> {
    const env = this.options.env ?? process.env;
    const breakerConfig = readCircuitBreakerConfig(env);
    const requiredCapability = opts?.requiredCapability ?? 'chat_general';
    const attempts: GatewayAttempt[] = [];

    const primary = fallbackPolicy.resolvePrimary({ provider: opts?.preferredProvider, model: req.model }, env);
    const decision = evaluateEgress(primary.provider, primary.model, env);

    if (!decision.allowed) {
      return {
        ok: false,
        status: denialStatus(decision.reason),
        message: denialMessage(decision.reason),
        attempts: [{ provider: primary.provider, model: primary.model, outcome: 'policy_denied', message: decision.reason }],
      };
    }

    const chain = fallbackPolicy.buildChain(primary.provider, env);
    const candidates = [primary, ...chain];

    for (const candidate of candidates) {
      const key = breakerKey(candidate.provider, candidate.model);

      if (modelCircuitBreaker.isOpen(key, breakerConfig)) {
        attempts.push({ provider: candidate.provider, model: candidate.model, outcome: 'breaker_open' });
        continue;
      }

      const candidateDecision = evaluateEgress(candidate.provider, candidate.model, env);
      if (!candidateDecision.allowed) {
        attempts.push({ provider: candidate.provider, model: candidate.model, outcome: 'policy_denied', message: candidateDecision.reason });
        continue;
      }

      const qualification = this.checkQualification(candidate.provider, candidate.model, requiredCapability, env);
      if (!qualification.allowed) {
        attempts.push({ provider: candidate.provider, model: candidate.model, outcome: 'policy_denied', message: qualification.message });
        continue;
      }

      const adapter = this.getAdapter(candidate.provider);
      if (!adapter) {
        attempts.push({ provider: candidate.provider, model: candidate.model, outcome: 'provider_error', message: `Provider not registered: ${candidate.provider}` });
        continue;
      }

      try {
        const result = await adapter.complete(
          { ...req, model: candidate.model },
          { signal: opts?.signal },
        );
        modelCircuitBreaker.recordSuccess(key);
        attempts.push({ provider: candidate.provider, model: candidate.model, outcome: 'success', usage: result.usage });
        return { ok: true, provider: candidate.provider, model: candidate.model, result, attempts };
      } catch (err) {
        modelCircuitBreaker.recordFailure(key, breakerConfig);
        if (err instanceof ProviderCallError) {
          attempts.push({
            provider: candidate.provider,
            model: candidate.model,
            outcome: 'provider_error',
            status: err.status,
            message: err.message,
          });
        } else {
          attempts.push({
            provider: candidate.provider,
            model: candidate.model,
            outcome: 'provider_error',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    const firstPolicyDenial = attempts.find((a) => a.outcome === 'policy_denied');
    if (attempts.length > 0 && attempts.every((a) => a.outcome === 'policy_denied')) {
      return {
        ok: false,
        status: 403,
        message: firstPolicyDenial?.message ?? 'Ningun modelo disponible para la solicitud',
        attempts,
      };
    }

    const configFailure = attempts.find((a) => a.outcome === 'provider_error' && a.status === 503);
    const status = configFailure ? 503 : 502;
    const message = configFailure
      ? (configFailure.message ?? 'IA no configurada en el servidor')
      : 'Proveedor de IA no disponible';

    return { ok: false, status, message, attempts };
  }

  private checkQualification(
    provider: AIProviderId,
    model: string,
    capability: AIModelCapability,
    env: NodeJS.ProcessEnv,
  ): { allowed: boolean; message?: string } {
    if ((env.AI_QUALIFICATION_ENFORCED ?? 'true') !== 'true') {
      return { allowed: true };
    }

    const key = `${provider}/${model}`;
    const certification = modelQualificationRegistry.getCertification(key, capability);
    if (!certification || certification.status === 'not_qualified') {
      return { allowed: false, message: `Modelo no certificado para la capacidad '${capability}'` };
    }
    if (certification.status === 'qualified') {
      return { allowed: false, message: `Modelo solo calificado (no certificado) para la capacidad '${capability}'` };
    }

    const currentFingerprint = getDatasetFingerprint();
    if (modelQualificationRegistry.isStale(key, capability, currentFingerprint)) {
      return { allowed: false, message: `Revalidacion pendiente para la capacidad '${capability}'` };
    }

    const pin = pinnedVersionPolicy.check(provider, model, env);
    if (!pin.allowed) {
      return { allowed: false, message: `Version de modelo no permitida para ${provider} (esperada '${pin.expected}', recibida '${pin.actual}')` };
    }

    return { allowed: true };
  }
}

export const aiGateway = new AIGateway();
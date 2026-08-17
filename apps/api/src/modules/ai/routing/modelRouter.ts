import type { AIModelCapability } from '../evaluation/capabilities.js';
import { getAllowedProviders } from '../aiEgressPolicy.js';
import { compareResidency } from '../egress/providerDataPolicy.js';
import type { ModelRegistry } from '../models/modelRegistry.js';
import type { ProviderDataPolicy } from '../egress/providerDataPolicy.js';
import type { RiskLevel } from '../contracts/riskModel.js';
import type { CertificationResolution } from '../certification/clinicalCertification.js';

export interface RoutingTarget {
  provider: string;
  model: string;
}

export type RejectionReason =
  | 'unknown_model'
  | 'disabled_model'
  | 'invalid_preference'
  | 'provider_not_allowed'
  | 'breaker_open'
  | 'capability_unsupported'
  | 'structured_output_unsupported'
  | 'tools_unsupported'
  | 'phi_not_allowed'
  | 'residency_mismatch'
  | 'residency_unknown'
  | 'qualification_denied'
  | 'certification_denied'
  | 'stale_certification'
  | 'blocked_model'
  | 'experimental_not_allowed';

export interface EligibilityNote {
  provider: string;
  model: string;
  reason: RejectionReason;
  message?: string;
}

export interface ModelRouteInput {
  capability: AIModelCapability;
  preferredProvider?: string;
  preferredModel?: string;
  providerOrder: string[];
  env: NodeJS.ProcessEnv;
  registry: Pick<ModelRegistry, 'get' | 'getDefaultModel'>;
  defaultModelByProvider: (provider: string) => string;
  breaker?: { isOpen(provider: string, model: string): boolean };
  qualification?: (provider: string, model: string, capability: AIModelCapability) => { allowed: boolean; message?: string };
  /** Certificación clínica granular: el riesgo efectivo decide el requisito; el router no certifica nada por sí mismo. */
  certification?: (provider: string, model: string, capability: AIModelCapability) => CertificationResolution;
  /** Riesgo efectivo calculado por código determinista (el router nunca lo baja). */
  effectiveRisk?: RiskLevel;
  providerDataPolicy?: (provider: string) => ProviderDataPolicy;
  requiredResidency?: string | null;
  clinicalDataPossible: boolean;
  structuredOutputRequired: boolean;
  toolsRequired: boolean;
}

export interface ModelRouteResult {
  /** Lista ordenada de candidatos (primary primero, luego cadena de fallback). */
  candidates: RoutingTarget[];
  /** Excluidos estructurales: nunca son candidatos (modelo desconocido/deshabilitado, proveedor no permitido, preferencia inválida). */
  rejected: EligibilityNote[];
  /** Análisis de elegibilidad de los candidatos; los gates del runtime deciden la ejecución. */
  ineligible: EligibilityNote[];
}

const BREAKER_OPEN: RejectionReason = 'breaker_open';

export class ModelRouter {
  route(input: ModelRouteInput): ModelRouteResult {
    const env = input.env;
    const allowedProviders = getAllowedProviders(env);
    const rejected: EligibilityNote[] = [];
    const ineligible: EligibilityNote[] = [];

    const primaryProvider = this.resolvePrimaryProvider(input.preferredProvider, input.providerOrder, allowedProviders, rejected);
    const primaryModel = this.resolvePrimaryModel(
      primaryProvider,
      input.preferredModel,
      input.registry,
      input.defaultModelByProvider,
      rejected,
    );

    const targets: RoutingTarget[] = [{ provider: primaryProvider, model: primaryModel }];
    for (const provider of input.providerOrder) {
      if (provider === primaryProvider) continue;
      const model = input.registry.getDefaultModel(provider) ?? input.defaultModelByProvider(provider);
      targets.push({ provider, model });
    }

    const candidates: RoutingTarget[] = [];
    for (const target of targets) {
      const info = input.registry.get(target.model);
      if (!info) {
        rejected.push({ provider: target.provider, model: target.model, reason: 'unknown_model', message: `Modelo '${target.model}' no registrado` });
        continue;
      }
      if (!info.enabled) {
        rejected.push({ provider: target.provider, model: target.model, reason: 'disabled_model', message: `Modelo '${target.model}' deshabilitado` });
        continue;
      }
      if (!allowedProviders.includes(target.provider)) {
        rejected.push({ provider: target.provider, model: target.model, reason: 'provider_not_allowed', message: `Proveedor '${target.provider}' no permitido` });
        continue;
      }
      candidates.push(target);
      this.analyzeEligibility(target, info, input, ineligible);
    }

    return { candidates, rejected, ineligible };
  }

  private resolvePrimaryProvider(
    preferred: string | undefined,
    providerOrder: string[],
    allowedProviders: string[],
    rejected: EligibilityNote[],
  ): string {
    if (preferred && allowedProviders.includes(preferred)) {
      return preferred;
    }
    if (preferred) {
      rejected.push({ provider: preferred, model: '', reason: 'invalid_preference', message: `Preferencia '${preferred}' no permitida; se usa el default` });
    }
    return providerOrder[0] ?? 'openai';
  }

  private resolvePrimaryModel(
    provider: string,
    preferred: string | undefined,
    registry: Pick<ModelRegistry, 'get' | 'getDefaultModel'>,
    defaultModelByProvider: (provider: string) => string,
    rejected: EligibilityNote[],
  ): string {
    const fallback = registry.getDefaultModel(provider) ?? defaultModelByProvider(provider);
    if (!preferred) return fallback;

    const info = registry.get(preferred);
    if (!info) {
      rejected.push({ provider, model: preferred, reason: 'unknown_model', message: `Modelo preferido '${preferred}' no registrado` });
      return fallback;
    }
    if (!info.enabled) {
      rejected.push({ provider, model: preferred, reason: 'disabled_model', message: `Modelo preferido '${preferred}' deshabilitado` });
      return fallback;
    }
    if (info.provider !== provider) {
      rejected.push({ provider, model: preferred, reason: 'invalid_preference', message: `Modelo preferido '${preferred}' no pertenece al proveedor '${provider}'` });
      return fallback;
    }
    if (!info.respectsRequestedModel) {
      rejected.push({ provider, model: preferred, reason: 'invalid_preference', message: `El proveedor '${provider}' solo usa su modelo default` });
      return fallback;
    }
    return preferred;
  }

  private analyzeEligibility(
    target: RoutingTarget,
    info: { supportsStructuredOutput: boolean; supportsTools: boolean; supportedCapabilities: AIModelCapability[] },
    input: ModelRouteInput,
    notes: EligibilityNote[],
  ): void {
    const note = (reason: RejectionReason, message: string): void => {
      notes.push({ provider: target.provider, model: target.model, reason, message });
    };

    if (!info.supportedCapabilities.includes(input.capability)) {
      note('capability_unsupported', `El modelo '${target.model}' no declara la capacidad '${input.capability}'`);
    }
    if (input.structuredOutputRequired && !info.supportsStructuredOutput) {
      note('structured_output_unsupported', `El modelo '${target.model}' no soporta salida estructurada`);
    }
    if (input.toolsRequired && !info.supportsTools) {
      note('tools_unsupported', `El modelo '${target.model}' no soporta herramientas`);
    }
    if (input.qualification) {
      const qualification = input.qualification(target.provider, target.model, input.capability);
      if (!qualification.allowed) {
        note('qualification_denied', qualification.message ?? 'No supera el gate de calificación');
      }
    }
    if (input.certification) {
      const resolution = input.certification(target.provider, target.model, input.capability);
      if (!resolution.eligible) {
        if (resolution.state === 'BLOCKED') {
          note('blocked_model', resolution.reason ?? 'Modelo BLOCKED');
        } else if (resolution.stale) {
          note('stale_certification', resolution.reason ?? 'Certificación stale (requalification requerida)');
        } else if (resolution.state === 'EXPERIMENTAL') {
          note('experimental_not_allowed', resolution.reason ?? 'Modelo EXPERIMENTAL no elegible');
        } else {
          note('certification_denied', resolution.reason ?? 'Certificación clínica no satisfecha');
        }
      }
    }
    if (input.breaker?.isOpen(target.provider, target.model)) {
      note(BREAKER_OPEN, `Circuit breaker abierto para '${target.provider}:${target.model}'`);
    }
    if (input.clinicalDataPossible && input.providerDataPolicy) {
      const policy = input.providerDataPolicy(target.provider);
      if (!policy.phiAllowed) {
        note('phi_not_allowed', `El proveedor '${target.provider}' no permite datos clínicos`);
      }
      if (input.requiredResidency && input.requiredResidency !== 'any') {
        const match = compareResidency(input.requiredResidency, policy.dataResidency);
        if (match === 'mismatch') {
          note('residency_mismatch', `El proveedor '${target.provider}' no cumple la residencia '${input.requiredResidency}'`);
        }
        if (match === 'unknown') {
          note('residency_unknown', `Residencia desconocida para '${target.provider}'`);
        }
      }
    }
  }
}

export const modelRouter = new ModelRouter();
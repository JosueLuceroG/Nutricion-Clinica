import { randomUUID } from 'node:crypto';
import { evaluateEgress, getAllowedProviders, type EgressDenialReason } from './aiEgressPolicy.js';
import { getAIProvider, credentialProvider, type AIProviderId } from './credentialProvider.js';
import { AIDataEgressPolicy } from './egress/egressPolicy.js';
import type { EgressReasonCode } from './egress/egressPolicy.js';
import { getCapabilityContract, DEFAULT_EGRESS_CAPABILITY } from './egress/capabilityContracts.js';
import type { AIModelCapability } from './evaluation/capabilities.js';
import { modelQualificationRegistry } from './evaluation/certification.js';
import { getDatasetFingerprint } from './evaluation/nutritionGoldenDataset.js';
import { pinnedVersionPolicy } from './evaluation/pinnedVersions.js';
import { modelRegistry, resolvedModelVersion, type ModelRegistry } from './models/modelRegistry.js';
import { ProviderCallError, type AICompletionRequest, type AICompletionResult, type AIUsage } from './providers/aiProviderAdapter.js';
import { providerRegistry } from './providers/providerRegistry.js';
import { getFallbackProviderOrder } from './routing/fallbackPolicy.js';
import { ModelRouter } from './routing/modelRouter.js';
import { modelCircuitBreaker, readCircuitBreakerConfig } from './resilience/modelCircuitBreaker.js';
import { capabilityRiskRegistry } from './contracts/capabilityRiskRegistry.js';
import { computeEffectiveRisk, type RiskLevel, type RiskSignals } from './contracts/riskModel.js';
import { isProfessionalReviewRequired } from './contracts/humanReviewPolicy.js';
import type { ConfidenceCategory } from './contracts/confidenceEngine.js';
import { clinicalCertificationRegistry } from './certification/clinicalCertification.js';
import { requiredCertificationFor, type CertificationState } from './certification/certificationStates.js';
import { CURRENT_VERSIONS } from './certification/versions.js';

export type GatewayAttemptOutcome = 'success' | 'policy_denied' | 'breaker_open' | 'provider_error';

export interface GatewayAttempt {
  provider: string;
  model: string;
  outcome: GatewayAttemptOutcome;
  status?: number;
  message?: string;
  usage?: AIUsage;
}

export type AIErrorCode =
  | 'AI_DISABLED'
  | 'CAPABILITY_DENIED'
  | 'CONSENT_REQUIRED'
  | 'NO_ELIGIBLE_MODEL'
  | 'PROVIDER_UNAVAILABLE'
  | 'MODEL_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'INVALID_AI_RESPONSE';

export type GatewayResult =
  | {
      ok: true;
      provider: string;
      model: string;
      result: AICompletionResult;
      attempts: GatewayAttempt[];
      executionId: string;
      correlationId: string;
      clinical?: ClinicalExecutionMetadata;
    }
  | {
      ok: false;
      status: number;
      code: AIErrorCode;
      message: string;
      attempts: GatewayAttempt[];
      executionId: string;
      correlationId: string;
      clinical?: ClinicalExecutionMetadata;
    };

/** Metadata clínica segura para auditoría (nunca PHI crudo). */
export interface ClinicalExecutionMetadata {
  capability: string;
  baseRisk: RiskLevel;
  effectiveRisk: RiskLevel;
  modelVersion: string;
  certificationState?: CertificationState;
  certificationId?: string;
  promptVersion: string;
  toolsetVersion: string;
  policyVersion: string;
  outputSchemaVersion: string;
  confidence?: ConfidenceCategory;
  abstained: boolean;
  requiresProfessionalReview: boolean;
}

export interface AIGatewayEgressContext {
  capability: string;
  patientId?: string;
  sucursalId?: string;
  actor?: { profesionalId?: string; role?: string };
  structured?: Array<{ shape: string; value: unknown }>;
}

export interface OrchestratorExecutionInput {
  request: AICompletionRequest;
  requiredCapability?: AIModelCapability;
  preferredProvider?: string;
  preferredModel?: string;
  signal?: AbortSignal;
  egress?: AIGatewayEgressContext;
  correlationId?: string;
  /** Señales deterministas para el cálculo del riesgo efectivo (el LLM nunca lo define). */
  riskSignals?: RiskSignals;
}

export interface AIOrchestratorOptions {
  getProviderAdapter?: (provider: string) => ProviderLike | undefined;
  env?: () => NodeJS.ProcessEnv;
  egressPolicy?: AIDataEgressPolicy;
  modelRegistry?: ModelRegistry;
  modelRouter?: ModelRouter;
}

interface ProviderLike {
  complete(req: AICompletionRequest, opts?: { signal?: AbortSignal }): Promise<AICompletionResult>;
}

/** Denegaciones globales de la solicitud: ningún candidato las puede resolver. */
const TERMINAL_DENIAL_CODES: readonly EgressReasonCode[] = [
  'unknown_capability',
  'missing_patient_scope',
  'consent_missing',
  'consent_revoked',
  'consent_unverifiable',
];

function denialStatus(reason: EgressDenialReason): number {
  return reason === 'kill_switch' ? 503 : 403;
}

function denialMessage(reason: EgressDenialReason): string {
  return reason === 'kill_switch' ? 'IA deshabilitada' : 'Politica de egress IA deniega la solicitud';
}

function breakerKey(provider: string, model: string): string {
  return `${provider}:${model}`;
}

function denialCodeFrom(reasonCodes: string[]): AIErrorCode {
  if (reasonCodes.some((code) => code.startsWith('consent'))) return 'CONSENT_REQUIRED';
  if (reasonCodes.includes('unknown_capability') || reasonCodes.includes('missing_patient_scope')) return 'CAPABILITY_DENIED';
  return 'NO_ELIGIBLE_MODEL';
}

function operationalCode(attempts: GatewayAttempt[], status: number): AIErrorCode {
  if (status === 503) return 'PROVIDER_UNAVAILABLE';
  if (attempts.some((a) => a.outcome === 'provider_error' && a.message?.toLowerCase().includes('timeout'))) return 'TIMEOUT';
  if (attempts.some((a) => a.outcome === 'provider_error' && a.status === 429)) return 'RATE_LIMITED';
  if (status >= 400 && status < 500) return 'MODEL_UNAVAILABLE';
  return 'PROVIDER_UNAVAILABLE';
}

export class AIOrchestrator {
  private readonly egressPolicy: AIDataEgressPolicy;
  private readonly modelRegistry: ModelRegistry;
  private readonly router: ModelRouter;
  private readonly env: () => NodeJS.ProcessEnv;

  constructor(private readonly options: AIOrchestratorOptions = {}) {
    this.egressPolicy = options.egressPolicy ?? new AIDataEgressPolicy();
    this.modelRegistry = options.modelRegistry ?? modelRegistry;
    this.router = options.modelRouter ?? new ModelRouter();
    this.env = options.env ?? (() => process.env);
  }

  private getAdapter(provider: string): ProviderLike | undefined {
    return this.options.getProviderAdapter?.(provider) ?? providerRegistry.get(provider);
  }

  async execute(input: OrchestratorExecutionInput): Promise<GatewayResult> {
    const env = this.env();
    const executionId = randomUUID();
    const correlationId = input.correlationId ?? executionId;
    const breakerConfig = readCircuitBreakerConfig(env);
    const requiredCapability = input.requiredCapability ?? 'chat_general';
    const egressContext = input.egress;
    const egressCapability = egressContext?.capability ?? DEFAULT_EGRESS_CAPABILITY;
    const contract = getCapabilityContract(egressCapability);
    const clinicalDataPossible = contract?.phiAllowed ?? false;
    const requiredResidency = contract?.requiredResidency ?? null;
    const attempts: GatewayAttempt[] = [];

    const riskEntry = capabilityRiskRegistry.get(egressCapability);
    if (!riskEntry) {
      return {
        ok: false,
        status: 403,
        code: 'CAPABILITY_DENIED',
        message: 'Capability sin registro de riesgo',
        attempts: [{ provider: input.preferredProvider ?? '', model: '', outcome: 'policy_denied', message: 'unknown_capability' }],
        executionId,
        correlationId,
      };
    }
    const effectiveRisk = computeEffectiveRisk(riskEntry.baseRisk, input.riskSignals);
    const requiredCertification = requiredCertificationFor(effectiveRisk, riskEntry.minimumModelCertification);
    const reviewRequired = isProfessionalReviewRequired(effectiveRisk, riskEntry.humanReviewPolicy);
    const outputSchemaVersion = CURRENT_VERSIONS.outputSchemaVersion[requiredCapability] ?? CURRENT_VERSIONS.outputSchemaVersion.default;
    const clinicalBase: ClinicalExecutionMetadata = {
      capability: egressCapability,
      baseRisk: riskEntry.baseRisk,
      effectiveRisk,
      modelVersion: 'UNKNOWN',
      certificationState: undefined,
      certificationId: undefined,
      promptVersion: CURRENT_VERSIONS.promptVersion[requiredCapability] ?? '',
      toolsetVersion: CURRENT_VERSIONS.toolsetVersion,
      policyVersion: CURRENT_VERSIONS.policyVersion,
      outputSchemaVersion,
      abstained: false,
      requiresProfessionalReview: reviewRequired,
    };

    const fallbackOrder = getFallbackProviderOrder(env);
    const allowedProviders = getAllowedProviders(env);
    if (input.preferredProvider && !allowedProviders.includes(input.preferredProvider)) {
      return {
        ok: false,
        status: 403,
        code: 'NO_ELIGIBLE_MODEL',
        message: 'Politica de egress IA deniega la solicitud',
        attempts: [{ provider: input.preferredProvider, model: '', outcome: 'policy_denied', message: 'provider' }],
        executionId,
        correlationId,
        clinical: clinicalBase,
      };
    }
    const primaryProvider = input.preferredProvider ?? getAIProvider(env);
    const primaryModel = this.resolvePrimaryModel(primaryProvider, input.preferredModel, env);

    const primaryDecision = evaluateEgress(primaryProvider, primaryModel, env);
    if (!primaryDecision.allowed) {
      return {
        ok: false,
        status: denialStatus(primaryDecision.reason),
        code: primaryDecision.reason === 'kill_switch' ? 'AI_DISABLED' : 'NO_ELIGIBLE_MODEL',
        message: denialMessage(primaryDecision.reason),
        attempts: [{ provider: primaryProvider, model: primaryModel, outcome: 'policy_denied', message: primaryDecision.reason }],
        executionId,
        correlationId,
        clinical: clinicalBase,
      };
    }

    const qualificationEnforced = (env.AI_QUALIFICATION_ENFORCED ?? 'true') === 'true';
    const routeResult = this.router.route({
      capability: requiredCapability,
      preferredProvider: primaryProvider,
      preferredModel: input.preferredModel,
      providerOrder: fallbackOrder,
      env,
      registry: this.modelRegistry,
      defaultModelByProvider: (provider) => (provider === 'ollama' || provider === 'openai' ? credentialProvider.getDefaultModel(provider) : ''),
      breaker: { isOpen: (p, m) => modelCircuitBreaker.isOpen(breakerKey(p, m), breakerConfig) },
      qualification: (p, m, c) => this.checkQualification(p, m, c, env, effectiveRisk, requiredCertification),
      certification: qualificationEnforced
        ? (p, m, c) => clinicalCertificationRegistry.resolve(p, m, resolvedModelVersion(this.modelRegistry.get(m)), c, {
            requiredState: requiredCertification,
          })
        : undefined,
      effectiveRisk,
      clinicalDataPossible,
      requiredResidency,
      structuredOutputRequired: input.request.responseFormat === 'json',
      toolsRequired: false,
    });

    if (routeResult.candidates.length === 0) {
      return {
        ok: false,
        status: 403,
        code: 'NO_ELIGIBLE_MODEL',
        message: 'Ningun modelo elegible para la solicitud',
        attempts,
        executionId,
        correlationId,
        clinical: clinicalBase,
      };
    }

    for (const candidate of routeResult.candidates) {
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

      const qualification = this.checkQualification(candidate.provider, candidate.model, requiredCapability, env, effectiveRisk, requiredCertification);
      if (!qualification.allowed) {
        attempts.push({ provider: candidate.provider, model: candidate.model, outcome: 'policy_denied', message: qualification.message });
        continue;
      }

      let callRequest = input.request;
      if (egressContext) {
        const policyResult = await this.egressPolicy.evaluate(
          {
            capability: egressCapability,
            provider: candidate.provider,
            model: candidate.model,
            patientId: egressContext.patientId,
            sucursalId: egressContext.sucursalId,
            actor: egressContext.actor,
            systemPrompt: input.request.systemPrompt,
            userPrompt: input.request.userPrompt,
            structured: egressContext.structured,
          },
          executionId,
        );
        if (policyResult.decision === 'DENY') {
          attempts.push({ provider: candidate.provider, model: candidate.model, outcome: 'policy_denied', message: policyResult.reasonCodes.join(',') });
          if (policyResult.reasonCodes.some((code) => TERMINAL_DENIAL_CODES.includes(code as EgressReasonCode))) {
            break;
          }
          continue;
        }
        callRequest = { ...input.request, ...policyResult.request };
      }

      const adapter = this.getAdapter(candidate.provider);
      if (!adapter) {
        attempts.push({ provider: candidate.provider, model: candidate.model, outcome: 'provider_error', message: `Provider not registered: ${candidate.provider}` });
        continue;
      }

      try {
        const result = await adapter.complete(
          { ...callRequest, model: candidate.model },
          { signal: input.signal },
        );
        modelCircuitBreaker.recordSuccess(key);
        attempts.push({ provider: candidate.provider, model: candidate.model, outcome: 'success', usage: result.usage });
        const clinical: ClinicalExecutionMetadata = {
          ...clinicalBase,
          modelVersion: resolvedModelVersion(this.modelRegistry.get(candidate.model)),
          ...this.resolveCertificationMetadata(candidate.provider, candidate.model, requiredCapability, requiredCertification),
        };
        return { ok: true, provider: candidate.provider, model: candidate.model, result, attempts, executionId, correlationId, clinical };
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
      const message = firstPolicyDenial?.message ?? 'Ningun modelo disponible para la solicitud';
      return {
        ok: false,
        status: 403,
        code: denialCodeFrom(attempts.map((a) => a.message).filter((m): m is string => Boolean(m))),
        message,
        attempts,
        executionId,
        correlationId,
        clinical: { ...clinicalBase, abstained: true },
      };
    }

    const configFailure = attempts.find((a) => a.outcome === 'provider_error' && a.status === 503);
    const status = configFailure ? 503 : 502;
    const message = configFailure
      ? (configFailure.message ?? 'IA no configurada en el servidor')
      : 'Proveedor de IA no disponible';

    return { ok: false, status, code: operationalCode(attempts, status), message, attempts, executionId, correlationId, clinical: clinicalBase };
  }

  private resolveCertificationMetadata(
    provider: string,
    model: string,
    capability: AIModelCapability,
    requiredState: CertificationState,
  ): { certificationState?: CertificationState; certificationId?: string } {
    if ((this.env().AI_QUALIFICATION_ENFORCED ?? 'true') !== 'true') return {};
    const resolution = clinicalCertificationRegistry.resolve(
      provider,
      model,
      resolvedModelVersion(this.modelRegistry.get(model)),
      capability,
      { requiredState },
    );
    if (!resolution.eligible || !resolution.state) return {};
    return { certificationState: resolution.state, certificationId: resolution.certificationId };
  }

  private resolvePrimaryModel(provider: string, preferred: string | undefined, _env: NodeJS.ProcessEnv): string {
    const defaultModel = provider === 'ollama' || provider === 'openai'
      ? credentialProvider.getDefaultModel(provider)
      : '';
    const fallback = this.modelRegistry.getDefaultModel(provider) ?? defaultModel;
    if (!preferred) return fallback;
    const info = this.modelRegistry.get(preferred);
    if (!info || !info.enabled || info.provider !== provider || !info.respectsRequestedModel) return fallback;
    return preferred;
  }

  private checkQualification(
    provider: string,
    model: string,
    capability: AIModelCapability,
    env: NodeJS.ProcessEnv,
    effectiveRisk: RiskLevel,
    requiredCertification: CertificationState,
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

    const pin = pinnedVersionPolicy.check(provider as AIProviderId, model, env);
    if (!pin.allowed) {
      return { allowed: false, message: `Version de modelo no permitida para ${provider} (esperada '${pin.expected}', recibida '${pin.actual}')` };
    }

    if (effectiveRisk && requiredCertification) {
      const resolution = clinicalCertificationRegistry.resolve(
        provider,
        model,
        resolvedModelVersion(this.modelRegistry.get(model)),
        capability,
        { requiredState: requiredCertification },
      );
      if (!resolution.eligible) {
        return { allowed: false, message: resolution.reason ?? 'Certificación clínica no satisfecha' };
      }
    }

    return { allowed: true };
  }
}

export const aiOrchestrator = new AIOrchestrator();
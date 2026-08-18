import type { AIModelCapability } from '../evaluation/capabilities.js';
import { detectLocalHardwareProfile, isHardwareCompatible, type LocalHardwareProfile } from '../hardware/hardwareProfile.js';
import { buildCandidateManifest, type CandidateManifestEntry, type RuntimeModelRef } from '../models/candidateManifest.js';
import { buildDeploymentProfile, DEFAULT_INFERENCE_SETTINGS } from '../models/deploymentProfile.js';
import { clinicalCertificationRegistry, type CertificationResolution } from '../certification/clinicalCertification.js';
import type { RiskLevel } from '../contracts/riskModel.js';
import { selectLocalModel, type LocalAutoSelectionResult, type LocalCandidateStatus } from './localAutoSelector.js';

/**
 * Runtime de NUTRICLINICA_LOCAL_AUTO: detecta hardware real, lista modelos
 * instalados en el runtime local y construye el estado de candidatos sin
 * condicionales por nombre de modelo (diferencias SOLO via metadata/manifiesto).
 */

export interface OllamaRuntimeModelResponse {
  name: string;
  digest: string;
  quantization?: string | null;
}

/** Lista modelos instalados en Ollama (default). Sin runtime: [] (fail-closed). */
export async function listOllamaRuntimeModels(baseUrl?: string): Promise<RuntimeModelRef[]> {
  const url = (baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '');
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${url}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: OllamaRuntimeModelResponse[] };
    return (data.models ?? []).map((m) => ({
      modelId: m.name.split(':')[0]!,
      runtime: 'ollama',
      digest: m.digest,
      quantization: m.quantization ?? null,
      installed: true,
    }));
  } catch {
    return [];
  }
}

/** Soporte de capability derivado SOLO de metadata del manifiesto (UNKNOWN falla). */
export function candidateSupportsCapability(candidate: CandidateManifestEntry, capabilityId: string): boolean {
  switch (capabilityId) {
    case 'chat_general':
      return true;
    case 'structured_json':
      return candidate.structuredOutput === true;
    case 'nutrition_reasoning':
      return candidate.medicalSpecialization === true && candidate.reasoning !== false;
    case 'patient_support':
      return candidate.medicalSpecialization === true;
    default:
      return false;
  }
}

export interface LocalAutoRuntimeOptions {
  runtimeModelsProvider?: () => Promise<RuntimeModelRef[]>;
  breaker?: { isOpen(providerId: string, modelId: string): boolean };
  certification?: (providerId: string, modelId: string, modelVersion: string, capabilityId: AIModelCapability) => CertificationResolution;
  requalificationCheck?: (providerId: string, modelId: string, capabilityId: AIModelCapability) => boolean;
  qualityRanks?: Record<string, number | null>;
  benchmarkRanks?: Record<string, number | null>;
  latenciesMs?: Record<string, number | null>;
  allowExperimental?: boolean;
  modelVersions?: Record<string, string>;
}

export interface LocalAutoRuntimeInput {
  capabilityId: AIModelCapability;
  effectiveRisk: RiskLevel;
  requirePhi: boolean;
  requiredStructuredOutput: boolean;
  requiredTools: boolean;
  clientPreference: { providerId: string; modelId: string } | null;
  fallbackPolicy: 'LOCAL_ONLY' | 'LOCAL_PREFERRED_ALLOW_CLOUD';
  requiredCertificationState: string;
}

export interface LocalAutoRuntimeResult extends LocalAutoSelectionResult {
  hardware: LocalHardwareProfile;
  candidates: LocalCandidateStatus[];
}

export async function resolveLocalAutoSelection(
  input: LocalAutoRuntimeInput,
  options: LocalAutoRuntimeOptions = {},
): Promise<LocalAutoRuntimeResult> {
  const hardware = await detectLocalHardwareProfile();
  const runtimeModels = await (options.runtimeModelsProvider ?? listOllamaRuntimeModels)();
  const runtimeVersion =
    hardware.inferenceRuntimes.find((r) => r.runtime.toLowerCase() === 'ollama')?.runtimeVersion ?? null;
  const manifest = buildCandidateManifest({ runtimeModels, runtimeVersion });

  const candidates: LocalCandidateStatus[] = manifest.map((candidate) => {
    const deployment = buildDeploymentProfile({
      providerId: candidate.providerId,
      modelId: candidate.modelId,
      modelVersion: candidate.modelVersion,
      weightsRevision: candidate.weightsRevision,
      quantization: candidate.quantization,
      runtime: candidate.runtime,
      runtimeVersion: candidate.runtimeVersion,
      inferenceSettings: DEFAULT_INFERENCE_SETTINGS,
    });
    const modelVersion = options.modelVersions?.[candidate.modelId] ?? candidate.modelVersion;
    const certification = options.certification
      ? options.certification(candidate.providerId, candidate.modelId, modelVersion, input.capabilityId)
      : clinicalCertificationRegistry.resolve(candidate.providerId, candidate.modelId, modelVersion, input.capabilityId, {
          requiredState: input.requiredCertificationState as Parameters<typeof clinicalCertificationRegistry.resolve>[4]['requiredState'],
          allowExperimental: options.allowExperimental,
        });
    if (options.requalificationCheck?.(candidate.providerId, candidate.modelId, input.capabilityId)) {
      certification.requalificationRequired = true;
    }
    return {
      candidate,
      deployment,
      hardwareCompatible: isHardwareCompatible(hardware, candidate.hardwareRequirements),
      providerHealthy: options.breaker ? !options.breaker.isOpen(candidate.providerId, candidate.modelId) : true,
      capabilitySupported: candidateSupportsCapability(candidate, input.capabilityId),
      structuredSupported: candidate.structuredOutput === true,
      toolsSupported: candidate.toolCalling === true,
      riskCompatible: input.effectiveRisk !== 'RISK_5',
      certification,
      benchmarkRank: options.benchmarkRanks?.[candidate.candidateId] ?? null,
      qualityRank: options.qualityRanks?.[candidate.candidateId] ?? null,
      latencyMs: options.latenciesMs?.[candidate.candidateId] ?? null,
      excludedReasons: [],
    };
  });

  const selection = selectLocalModel({
    capabilityId: input.capabilityId,
    effectiveRisk: input.effectiveRisk,
    requiredStructuredOutput: input.requiredStructuredOutput,
    requiredTools: input.requiredTools,
    requirePhi: input.requirePhi,
    clientPreference: input.clientPreference,
    candidates,
    fallbackPolicy: input.fallbackPolicy,
    hardwareProfile: hardware,
    requiredCertificationState: input.requiredCertificationState,
    allowExperimental: options.allowExperimental ?? false,
  });

  return { ...selection, hardware, candidates };
}
import { fnv1a32Hex } from '../rag/knowledgeVersioning.js';

/**
 * Identidad inmutable del deployment: mismo modelo con distinta
 * cuantización/runtime/settings = deployment distinto. Nunca se comparte
 * certificación entre deployments materialmente diferentes.
 */

export interface InferenceSettings {
  temperature: number;
  topP: number;
  reasoning?: boolean;
  maxOutputTokens: number;
  contextWindow: number;
  seed?: number;
}

export const DEFAULT_INFERENCE_SETTINGS: InferenceSettings = {
  temperature: 0.3,
  topP: 1,
  reasoning: false,
  maxOutputTokens: 1024,
  contextWindow: 8192,
};

export interface DeploymentProfileInput {
  providerId: string;
  modelId: string;
  modelVersion: string;
  weightsRevision?: string;
  quantization?: string;
  runtime: string;
  runtimeVersion?: string;
  inferenceSettings: InferenceSettings;
}

export interface DeploymentProfile {
  deploymentId: string;
  fingerprint: string;
  providerId: string;
  modelId: string;
  modelVersion: string;
  weightsRevision: string | null;
  quantization: string | null;
  runtime: string;
  runtimeVersion: string | null;
  inferenceSettings: InferenceSettings;
}

export function buildDeploymentProfile(input: DeploymentProfileInput): DeploymentProfile {
  const parts = [
    input.providerId,
    input.modelId,
    input.modelVersion,
    input.weightsRevision ?? 'UNKNOWN_WEIGHTS',
    input.quantization ?? 'UNKNOWN_QUANT',
    input.runtime,
    input.runtimeVersion ?? 'UNKNOWN_RUNTIME_VERSION',
    `t${input.inferenceSettings.temperature}`,
    `p${input.inferenceSettings.topP}`,
    `m${input.inferenceSettings.maxOutputTokens}`,
    `c${input.inferenceSettings.contextWindow}`,
    input.inferenceSettings.reasoning === true ? 'reasoning-on' : 'reasoning-off',
    input.inferenceSettings.seed === undefined ? 'seed-any' : `seed-${input.inferenceSettings.seed}`,
  ];
  const fingerprint = `deploy-${fnv1a32Hex(parts.join('|'))}`;
  return {
    deploymentId: `${input.providerId}/${input.modelId}@${input.modelVersion}`,
    fingerprint,
    providerId: input.providerId,
    modelId: input.modelId,
    modelVersion: input.modelVersion,
    weightsRevision: input.weightsRevision ?? null,
    quantization: input.quantization ?? null,
    runtime: input.runtime,
    runtimeVersion: input.runtimeVersion ?? null,
    inferenceSettings: { ...input.inferenceSettings },
  };
}

/** Cambio material (digest/cuantización/runtime/settings) → fingerprint distinto. */
export function sameDeployment(a: DeploymentProfile, b: DeploymentProfileInput): boolean {
  return (
    a.providerId === b.providerId &&
    a.modelId === b.modelId &&
    a.modelVersion === b.modelVersion &&
    (a.weightsRevision ?? 'UNKNOWN_WEIGHTS') === (b.weightsRevision ?? 'UNKNOWN_WEIGHTS') &&
    (a.quantization ?? 'UNKNOWN_QUANT') === (b.quantization ?? 'UNKNOWN_QUANT') &&
    a.runtime === b.runtime &&
    (a.runtimeVersion ?? 'UNKNOWN_RUNTIME_VERSION') === (b.runtimeVersion ?? 'UNKNOWN_RUNTIME_VERSION') &&
    JSON.stringify(a.inferenceSettings) === JSON.stringify(b.inferenceSettings)
  );
}
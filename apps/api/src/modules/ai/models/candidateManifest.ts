/**
 * Manifiesto de candidatos de modelo, agnóstico de proveedor.
 * NUNCA se hardcodea lógica de routing por nombre de modelo aquí:
 * esto es metadata verificable (o UNKNOWN).
 */

export type CandidateStatus =
  | 'AVAILABLE_IN_CATALOG'
  | 'INSTALLED'
  | 'LOADED'
  | 'HEALTHY'
  | 'BENCHMARKED'
  | 'QUALIFIED'
  | 'CERTIFIED';

export const CANDIDATE_STATUSES: readonly CandidateStatus[] = [
  'AVAILABLE_IN_CATALOG',
  'INSTALLED',
  'LOADED',
  'HEALTHY',
  'BENCHMARKED',
  'QUALIFIED',
  'CERTIFIED',
];

export interface CandidateHardwareRequirements {
  minRamBytes?: number;
  minVramBytes?: number;
  gpuRequired?: boolean;
  diskBytes?: number;
}

export interface CandidateManifestEntry {
  candidateId: string;
  providerId: string;
  modelId: string;
  modelVersion: string;
  weightsRevision?: string;
  runtime: string;
  runtimeVersion?: string;
  quantization?: string;
  local: boolean;
  modelFamily: 'gpt-oss' | 'gemma' | 'qwen' | 'mistral-ministral' | 'medgemma' | 'llama' | 'UNKNOWN';
  parameterClass: 'tiny' | 'small' | 'medium' | 'large' | 'UNKNOWN';
  contextWindow: number | 'UNKNOWN';
  structuredOutput: boolean | 'UNKNOWN';
  toolCalling: boolean | 'UNKNOWN';
  reasoning: boolean | 'UNKNOWN';
  multilingual: boolean | 'UNKNOWN';
  medicalSpecialization: boolean;
  hardwareRequirements: CandidateHardwareRequirements;
  license: string | 'UNKNOWN';
  source: string | 'UNKNOWN';
  enabled: boolean;
  installed: boolean;
  evaluationAllowed: boolean;
  productionAllowed: boolean;
  certificationStatus: 'NOT_EVALUATED' | 'EXPERIMENTAL' | 'APPROVED_NUTRITION_SUPPORT' | 'RESTRICTED' | 'BLOCKED' | 'STALE' | 'UNKNOWN';
}

export interface RuntimeModelRef {
  modelId: string;
  runtime: string;
  digest: string | null;
  quantization: string | null;
  installed: boolean;
}

/** Manifiesto inicial (familas permitidas por el Build 07.5). Los tamaños son
 *  referencias públicas; lo no verificado localmente queda UNKNOWN. */
export function buildCandidateManifest(input: {
  runtimeModels: RuntimeModelRef[];
  runtimeVersion: string | null;
}): CandidateManifestEntry[] {
  const runtime = 'ollama';
  const runtimeVersion = input.runtimeVersion;
  const isInstalled = (modelId: string): boolean =>
    input.runtimeModels.some((m) => m.modelId.toLowerCase() === modelId.toLowerCase() && m.installed);

  const bytes = (gb: number): number => Math.round(gb * 1024 * 1024 * 1024);
  const manifest: Array<Omit<CandidateManifestEntry, 'installed' | 'quantization' | 'weightsRevision'>> = [
    {
      candidateId: 'ollama-llama3.2-3b',
      providerId: 'ollama',
      modelId: 'llama3.2',
      modelVersion: '3.2',
      runtime,
      local: true,
      modelFamily: 'llama',
      parameterClass: 'small',
      contextWindow: 128_000,
      structuredOutput: 'UNKNOWN',
      toolCalling: 'UNKNOWN',
      reasoning: false,
      multilingual: true,
      medicalSpecialization: false,
      hardwareRequirements: { minRamBytes: bytes(8), diskBytes: bytes(3) },
      license: 'llama3.2-community',
      source: 'ollama-library (verified registry)',
      enabled: true,
      evaluationAllowed: true,
      productionAllowed: false,
      certificationStatus: 'STALE',
    },
    {
      candidateId: 'ollama-gpt-oss-20b',
      providerId: 'ollama',
      modelId: 'gpt-oss:20b',
      modelVersion: 'UNKNOWN',
      runtime,
      local: true,
      modelFamily: 'gpt-oss',
      parameterClass: 'medium',
      contextWindow: 'UNKNOWN',
      structuredOutput: true,
      toolCalling: true,
      reasoning: true,
      multilingual: 'UNKNOWN',
      medicalSpecialization: false,
      hardwareRequirements: { minRamBytes: bytes(24), gpuRequired: false, diskBytes: bytes(16) },
      license: 'apache-2.0',
      source: 'ollama-library (verified registry)',
      enabled: true,
      evaluationAllowed: true,
      productionAllowed: false,
      certificationStatus: 'NOT_EVALUATED',
    },
    {
      candidateId: 'ollama-gemma3-4b',
      providerId: 'ollama',
      modelId: 'gemma3:4b',
      modelVersion: 'UNKNOWN',
      runtime,
      local: true,
      modelFamily: 'gemma',
      parameterClass: 'small',
      contextWindow: 128_000,
      structuredOutput: 'UNKNOWN',
      toolCalling: 'UNKNOWN',
      reasoning: false,
      multilingual: true,
      medicalSpecialization: false,
      hardwareRequirements: { minRamBytes: bytes(8), diskBytes: bytes(4) },
      license: 'gemma-license (Google)',
      source: 'ollama-library (verified registry)',
      enabled: true,
      evaluationAllowed: true,
      productionAllowed: false,
      certificationStatus: 'NOT_EVALUATED',
    },
    {
      candidateId: 'ollama-qwen2.5-7b',
      providerId: 'ollama',
      modelId: 'qwen2.5:7b',
      modelVersion: 'UNKNOWN',
      runtime,
      local: true,
      modelFamily: 'qwen',
      parameterClass: 'small',
      contextWindow: 128_000,
      structuredOutput: 'UNKNOWN',
      toolCalling: 'UNKNOWN',
      reasoning: false,
      multilingual: true,
      medicalSpecialization: false,
      hardwareRequirements: { minRamBytes: bytes(8), diskBytes: bytes(6) },
      license: 'apache-2.0',
      source: 'ollama-library (verified registry)',
      enabled: true,
      evaluationAllowed: true,
      productionAllowed: false,
      certificationStatus: 'NOT_EVALUATED',
    },
    {
      candidateId: 'ollama-ministral-8b',
      providerId: 'ollama',
      modelId: 'ministral:8b',
      modelVersion: 'UNKNOWN',
      runtime,
      local: true,
      modelFamily: 'mistral-ministral',
      parameterClass: 'small',
      contextWindow: 128_000,
      structuredOutput: 'UNKNOWN',
      toolCalling: 'UNKNOWN',
      reasoning: false,
      multilingual: 'UNKNOWN',
      medicalSpecialization: false,
      hardwareRequirements: { minRamBytes: bytes(10), diskBytes: bytes(6) },
      license: 'mistral-inference-license',
      source: 'ollama-library (verified registry)',
      enabled: true,
      evaluationAllowed: true,
      productionAllowed: false,
      certificationStatus: 'NOT_EVALUATED',
    },
    {
      candidateId: 'ollama-medgemma-3b',
      providerId: 'ollama',
      modelId: 'medgemma:3b',
      modelVersion: 'UNKNOWN',
      runtime,
      local: true,
      modelFamily: 'medgemma',
      parameterClass: 'small',
      contextWindow: 'UNKNOWN',
      structuredOutput: 'UNKNOWN',
      toolCalling: false,
      reasoning: false,
      multilingual: false,
      medicalSpecialization: true,
      hardwareRequirements: { minRamBytes: bytes(8), diskBytes: bytes(4) },
      license: 'gemma-license (Google)',
      source: 'ollama-library (verified registry)',
      enabled: true,
      evaluationAllowed: true,
      productionAllowed: false,
      certificationStatus: 'NOT_EVALUATED',
    },
  ];

  return manifest.map((entry) => {
    const installed = isInstalled(entry.modelId);
    const runtimeModel = input.runtimeModels.find((m) => m.modelId.toLowerCase() === entry.modelId.toLowerCase());
    return {
      ...entry,
      ...(runtimeVersion ? { runtimeVersion } : {}),
      ...(runtimeModel?.quantization ? { quantization: runtimeModel.quantization } : {}),
      ...(runtimeModel?.digest ? { weightsRevision: runtimeModel.digest } : {}),
      installed,
    };
  });
}

/** Bloques honestos: no se descarga nada sin config de operador. */
export type CandidateBlockReason =
  | 'NOT_INSTALLED'
  | 'BLOCKED_BY_HARDWARE'
  | 'BLOCKED_BY_RUNTIME'
  | 'BLOCKED_BY_DOWNLOAD'
  | 'BLOCKED_BY_OPERATOR'
  | 'UNKNOWN';

export function candidateAvailability(entry: CandidateManifestEntry, input: { downloadPolicy: 'operator_config_required' | 'allowed' }): 'AVAILABLE' | CandidateBlockReason {
  if (!entry.enabled) return 'BLOCKED_BY_OPERATOR';
  if (entry.installed) return 'AVAILABLE';
  if (input.downloadPolicy === 'operator_config_required') return 'BLOCKED_BY_DOWNLOAD';
  return 'NOT_INSTALLED';
}
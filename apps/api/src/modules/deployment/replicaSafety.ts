import { readEnvironmentClass } from "./environmentIdentity.js";

export const CERTIFIED_MAX_API_REPLICAS = 1 as const;
export const CERTIFIED_MAX_JOBS_REPLICAS = 1 as const;
export const MULTI_REPLICA_NOT_CERTIFIED =
  "MULTI_REPLICA_NOT_CERTIFIED" as const;
export const INVALID_REPLICA_CONFIGURATION =
  "INVALID_REPLICA_CONFIGURATION" as const;

export type ReplicaCertificationStatus =
  | "CERTIFIED_SINGLE_REPLICA"
  | typeof MULTI_REPLICA_NOT_CERTIFIED
  | typeof INVALID_REPLICA_CONFIGURATION;

export interface ReplicaWorkloadSafety {
  requested: number | null;
  certifiedMaximum: 1;
  status: ReplicaCertificationStatus;
}

export interface ReplicaSafety {
  api: ReplicaWorkloadSafety;
  jobs: ReplicaWorkloadSafety;
  etlConcurrency: "BLOCKED_NO_LEASE_RENEWAL";
  retentionConcurrency: "BLOCKED_NO_DISTRIBUTED_LOCK";
}

export class ReplicaConfigurationError extends Error {
  constructor(
    readonly code:
      | typeof MULTI_REPLICA_NOT_CERTIFIED
      | typeof INVALID_REPLICA_CONFIGURATION,
    detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = code;
  }
}

function parseReplicaCount(value: string | undefined): number | null {
  const raw = value?.trim();
  if (!raw) return 1;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}

function workloadSafety(requested: number | null): ReplicaWorkloadSafety {
  return {
    requested,
    certifiedMaximum: 1,
    status:
      requested === null
        ? INVALID_REPLICA_CONFIGURATION
        : requested > 1
          ? MULTI_REPLICA_NOT_CERTIFIED
          : "CERTIFIED_SINGLE_REPLICA",
  };
}

export function evaluateReplicaSafety(
  env: NodeJS.ProcessEnv = process.env,
): ReplicaSafety {
  return {
    api: workloadSafety(parseReplicaCount(env.API_REPLICAS)),
    jobs: workloadSafety(parseReplicaCount(env.JOBS_REPLICAS)),
    etlConcurrency: "BLOCKED_NO_LEASE_RENEWAL",
    retentionConcurrency: "BLOCKED_NO_DISTRIBUTED_LOCK",
  };
}

export function assertReplicaConfiguration(
  env: NodeJS.ProcessEnv = process.env,
): { apiReplicas: number; jobsReplicas: number } {
  const safety = evaluateReplicaSafety(env);
  const invalidName =
    safety.api.status === INVALID_REPLICA_CONFIGURATION
      ? "API_REPLICAS"
      : safety.jobs.status === INVALID_REPLICA_CONFIGURATION
        ? "JOBS_REPLICAS"
        : null;
  if (invalidName) {
    throw new ReplicaConfigurationError(
      INVALID_REPLICA_CONFIGURATION,
      `${invalidName} debe ser un entero positivo`,
    );
  }

  const environmentClass = readEnvironmentClass(env);
  if (
    (environmentClass === "STAGING" || environmentClass === "PRODUCTION") &&
    (safety.api.status === MULTI_REPLICA_NOT_CERTIFIED ||
      safety.jobs.status === MULTI_REPLICA_NOT_CERTIFIED)
  ) {
    throw new ReplicaConfigurationError(
      MULTI_REPLICA_NOT_CERTIFIED,
      `API_REPLICAS=${safety.api.requested}; JOBS_REPLICAS=${safety.jobs.requested}; maximo certificado=1/1`,
    );
  }

  return {
    apiReplicas: safety.api.requested!,
    jobsReplicas: safety.jobs.requested!,
  };
}

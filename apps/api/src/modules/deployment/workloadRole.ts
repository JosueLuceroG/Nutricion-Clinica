import { readEnvironmentClass } from "./environmentIdentity.js";

export const WORKLOAD_ROLES = [
  "api",
  "jobs",
  "migration",
  "dwh-schema",
] as const;
export type WorkloadRole = (typeof WORKLOAD_ROLES)[number];

export function assertWorkloadRole(
  expected: WorkloadRole,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const configured = env.WORKLOAD_ROLE?.trim();
  const environmentClass = readEnvironmentClass(env);
  if (configured && configured !== expected) {
    throw new Error(
      `WORKLOAD_ROLE=${configured} no coincide con entrypoint ${expected}`,
    );
  }
  if (
    (environmentClass === "STAGING" || environmentClass === "PRODUCTION") &&
    !configured
  ) {
    throw new Error(
      `WORKLOAD_ROLE=${expected} explicito es obligatorio en ${environmentClass}`,
    );
  }
}

import { readEnvironmentClass } from "./environmentIdentity.js";
import { safeEvidenceReference } from "./deploymentEvidence.js";

export interface StagingAvailability {
  identityDeclared: boolean;
  status: "AVAILABLE" | "NOT_AVAILABLE";
  evidenceId: string | null;
  evidenceCommit: string | null;
}

export function readStagingAvailability(
  env: NodeJS.ProcessEnv = process.env,
): StagingAvailability {
  const evidenceId = safeEvidenceReference(env.STAGING_EVIDENCE_ID);
  const evidenceCommit = env.STAGING_EVIDENCE_COMMIT?.trim() || null;
  const attested =
    env.STAGING_AVAILABILITY_ATTESTED === "true" &&
    env.STAGING_SMOKE_STATUS === "PASS" &&
    Boolean(evidenceId) &&
    /^[0-9a-f]{40}$/i.test(evidenceCommit ?? "") &&
    evidenceCommit === env.GIT_COMMIT?.trim();
  return {
    identityDeclared: readEnvironmentClass(env) === "STAGING",
    status: attested ? "AVAILABLE" : "NOT_AVAILABLE",
    evidenceId: attested ? evidenceId : null,
    evidenceCommit: attested ? evidenceCommit : null,
  };
}

import { describe, expect, it } from "vitest";
import { readStagingAvailability } from "./stagingAvailability.js";

describe("staging availability evidence", () => {
  it("does not infer availability from environment identity", () => {
    expect(readStagingAvailability({ ENVIRONMENT_CLASS: "STAGING" })).toEqual({
      identityDeclared: true,
      status: "NOT_AVAILABLE",
      evidenceId: null,
      evidenceCommit: null,
    });
  });

  it("requires attestation, smoke PASS, and evidence id", () => {
    expect(
      readStagingAvailability({
        ENVIRONMENT_CLASS: "STAGING",
        STAGING_AVAILABILITY_ATTESTED: "true",
        STAGING_SMOKE_STATUS: "PASS",
        STAGING_EVIDENCE_ID: "evidence-2026-08-28",
        STAGING_EVIDENCE_COMMIT: "a".repeat(40),
        GIT_COMMIT: "a".repeat(40),
      }).status,
    ).toBe("AVAILABLE");
  });

  it("rejects stale smoke evidence from another commit", () => {
    expect(
      readStagingAvailability({
        ENVIRONMENT_CLASS: "STAGING",
        STAGING_AVAILABILITY_ATTESTED: "true",
        STAGING_SMOKE_STATUS: "PASS",
        STAGING_EVIDENCE_ID: "evidence-2026-08-28",
        STAGING_EVIDENCE_COMMIT: "a".repeat(40),
        GIT_COMMIT: "b".repeat(40),
      }).status,
    ).toBe("NOT_AVAILABLE");
  });
});

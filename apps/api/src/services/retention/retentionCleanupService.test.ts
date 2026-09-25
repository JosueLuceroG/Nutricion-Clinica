import { describe, expect, it } from "vitest";
import { runRetentionCleanup } from "./retentionCleanupService.js";

describe("runRetentionCleanup", () => {
  it("returns empty result when no pool (handles error gracefully)", async () => {
    const result = await runRetentionCleanup();
    expect(result).toHaveProperty("deletedCount");
    expect(result).toHaveProperty("errors");
    expect(typeof result.deletedCount).toBe("number");
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it("blocks destructive cleanup without legal-hold review attestation", async () => {
    const originalDryRun = process.env.RETENTION_CLEANUP_DRY_RUN;
    const originalAttestation =
      process.env.RETENTION_LEGAL_HOLD_REVIEW_ATTESTED;
    process.env.RETENTION_CLEANUP_DRY_RUN = "false";
    delete process.env.RETENTION_LEGAL_HOLD_REVIEW_ATTESTED;

    try {
      const result = await runRetentionCleanup();

      expect(result.deletedCount).toBe(0);
      expect(result.errors).toContain("legal hold review attestation missing");
    } finally {
      if (originalDryRun === undefined)
        delete process.env.RETENTION_CLEANUP_DRY_RUN;
      else process.env.RETENTION_CLEANUP_DRY_RUN = originalDryRun;
      if (originalAttestation === undefined)
        delete process.env.RETENTION_LEGAL_HOLD_REVIEW_ATTESTED;
      else
        process.env.RETENTION_LEGAL_HOLD_REVIEW_ATTESTED = originalAttestation;
    }
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: "" }));

const pool = {
  request() {
    return {
      input() {
        return this;
      },
      async query(query: string) {
        mocks.query = query;
        return { recordset: [] };
      },
    };
  },
};

vi.mock("../../db/connection.js", () => ({
  getPool: () => Promise.resolve(pool),
}));

import { runRetentionCleanup } from "./retentionCleanupService.js";

describe("retention cleanup selection", () => {
  beforeEach(() => {
    mocks.query = "";
    vi.stubEnv("RETENTION_CLEANUP_DRY_RUN", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hard-deletes expired rows even when they were soft-deleted earlier", async () => {
    await runRetentionCleanup();

    expect(mocks.query).toContain("retention_until < SYSUTCDATETIME()");
    expect(mocks.query).not.toContain("deleted_at IS NULL");
  });
});

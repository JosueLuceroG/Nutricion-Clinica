import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDwhPool: vi.fn(),
}));

vi.mock("./dwhConnection.js", () => ({
  getDwhPool: mocks.getDwhPool,
}));

import { SqlDwhStore } from "./dwhStore.js";

function fakePool() {
  const request = {
    input: vi.fn(function () {
      return request;
    }),
    batch: vi.fn(async () => ({ recordset: [] })),
    query: vi.fn(async () => ({ recordset: [] })),
  };
  return { pool: { request: vi.fn(() => request) }, request };
}

describe("SqlDwhStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the dedicated DWH pool for snapshot writes", async () => {
    const fake = fakePool();
    mocks.getDwhPool.mockResolvedValue(fake.pool);
    const store = new SqlDwhStore();

    await store.saveSnapshot({
      metricId: "consultation_count",
      dimensionKey: "2026-01-01",
      value: 4,
      loadedAt: "2026-01-01T00:00:00.000Z",
      sourceRunId: "11111111-1111-4111-8111-111111111111",
    });

    expect(mocks.getDwhPool).toHaveBeenCalledOnce();
    expect(fake.pool.request).toHaveBeenCalledOnce();
    expect(fake.request.batch).toHaveBeenCalledWith(
      expect.stringContaining("dwh_metric_snapshots"),
    );
  });

  it("uses the dedicated DWH pool for load-run reads", async () => {
    const fake = fakePool();
    fake.request.query.mockResolvedValueOnce({ recordset: [] });
    mocks.getDwhPool.mockResolvedValue(fake.pool);

    const result = await new SqlDwhStore().getLoadRun(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(result).toBeUndefined();
    expect(mocks.getDwhPool).toHaveBeenCalledOnce();
  });
});

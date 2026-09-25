import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  schedule: vi.fn(),
  cleanup: vi.fn(),
  startDwh: vi.fn(),
  stopDwh: vi.fn(),
}));

vi.mock("node-cron", () => ({
  default: { schedule: mocks.schedule, validate: () => true },
}));
vi.mock("../retention/retentionConfig.js", () => ({
  RETENTION_CONFIG: {
    cleanupEnabled: true,
    cronSchedule: "0 3 * * *",
    cronTimezone: "UTC",
  },
}));
vi.mock("../retention/retentionCleanupService.js", () => ({
  runRetentionCleanup: mocks.cleanup,
}));
vi.mock("../../modules/dwh/scheduler.js", () => ({
  startDwhScheduler: mocks.startDwh,
  stopDwhScheduler: mocks.stopDwh,
}));

import { startRuntimeJobs } from "./runtimeJobs.js";

describe("runtime job lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.schedule.mockReturnValue({ destroy: vi.fn() });
    mocks.startDwh.mockReturnValue(null);
    mocks.stopDwh.mockResolvedValue(undefined);
  });

  it("returns cleanup promises to cron and drains active cleanup on stop", async () => {
    let resolveCleanup!: (value: {
      eligibleCount: number;
      deletedCount: number;
      dryRun: boolean;
      errors: string[];
    }) => void;
    mocks.cleanup.mockReturnValue(
      new Promise((resolve) => {
        resolveCleanup = resolve;
      }),
    );

    const jobs = startRuntimeJobs();
    const callback = mocks.schedule.mock.calls[0]?.[1] as () => Promise<void>;
    const activeRun = callback();
    let stopped = false;
    const stopping = jobs.stop().then(() => {
      stopped = true;
    });

    await Promise.resolve();
    expect(stopped).toBe(false);
    expect(mocks.schedule.mock.calls[0]?.[2]).toMatchObject({
      noOverlap: true,
    });

    resolveCleanup({
      eligibleCount: 0,
      deletedCount: 0,
      dryRun: true,
      errors: [],
    });
    await Promise.all([activeRun, stopping]);
    expect(stopped).toBe(true);
  });

  it("destroys the retention schedule when DWH scheduler startup fails", () => {
    const destroy = vi.fn();
    mocks.schedule.mockReturnValue({ destroy });
    mocks.startDwh.mockImplementation(() => {
      throw new Error("invalid DWH schedule");
    });

    expect(() => startRuntimeJobs()).toThrow("invalid DWH schedule");
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("reports retention failures at error severity", async () => {
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.cleanup.mockResolvedValue({
      eligibleCount: 1,
      deletedCount: 0,
      dryRun: false,
      errors: ["recording deletion failed"],
    });

    const jobs = startRuntimeJobs();
    const callback = mocks.schedule.mock.calls[0]?.[1] as () => Promise<void>;
    await callback();
    await jobs.stop();

    expect(logError).toHaveBeenCalledWith(expect.stringContaining("1 errors"));
    logError.mockRestore();
  });
});

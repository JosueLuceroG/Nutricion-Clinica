import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  schedule: vi.fn(),
  readDwhConfig: vi.fn(),
  runAllPipelines: vi.fn(),
}));

vi.mock("node-cron", () => ({
  default: { schedule: mocks.schedule, validate: () => true },
}));
vi.mock("./config.js", () => ({ readDwhConfig: mocks.readDwhConfig }));
vi.mock("./etl/engine.js", () => ({ runAllPipelines: mocks.runAllPipelines }));

import { startDwhScheduler, stopDwhScheduler } from "./scheduler.js";

const enabledConfig = {
  enabled: true,
  store: "sql",
  scheduledLoadEnabled: true,
  cronSchedule: "30 4 * * *",
  cronTimezone: "UTC",
};

describe("DWH scheduler lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.schedule.mockReturnValue({ destroy: vi.fn() });
  });

  afterEach(async () => {
    await stopDwhScheduler();
  });

  it.each([
    { enabled: false, store: "sql", scheduledLoadEnabled: true },
    { enabled: true, store: "memory", scheduledLoadEnabled: true },
    { enabled: true, store: "sql", scheduledLoadEnabled: false },
  ])("requires every DWH scheduling kill switch: %o", (overrides) => {
    mocks.readDwhConfig.mockReturnValue({ ...enabledConfig, ...overrides });

    expect(startDwhScheduler()).toBeNull();
    expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it("returns the ETL promise and drains it before stop completes", async () => {
    let resolveLoad!: (
      value: Array<{ pipelineId: string; status: string }>,
    ) => void;
    const load = new Promise<Array<{ pipelineId: string; status: string }>>(
      (resolve) => {
        resolveLoad = resolve;
      },
    );
    mocks.readDwhConfig.mockReturnValue(enabledConfig);
    mocks.runAllPipelines.mockReturnValue(load);

    startDwhScheduler();
    const callback = mocks.schedule.mock.calls[0]?.[1] as () => Promise<void>;
    const callbackResult = callback();
    let stopped = false;
    const stopping = stopDwhScheduler().then(() => {
      stopped = true;
    });

    await Promise.resolve();
    expect(stopped).toBe(false);
    expect(mocks.schedule.mock.calls[0]?.[2]).toMatchObject({
      noOverlap: true,
    });

    resolveLoad([{ pipelineId: "dim-date", status: "succeeded" }]);
    await Promise.all([callbackResult, stopping]);
    expect(stopped).toBe(true);
  });
});

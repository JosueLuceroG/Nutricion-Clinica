import { describe, expect, it } from "vitest";
import { readDwhConfig } from "./config.js";

describe("DWH config", () => {
  it("uses the documented numeric defaults", () => {
    expect(readDwhConfig({})).toMatchObject({
      loadWindowDays: 7,
      maxFreshnessDays: 3,
      smallCellMin: 5,
    });
  });

  it.each([
    ["DWH_LOAD_WINDOW_DAYS", "1.5"],
    ["DWH_MAX_FRESHNESS_DAYS", "NaN"],
    ["DWH_SMALL_CELL_MIN", "0"],
  ])("rejects invalid %s instead of changing policy", (name, value) => {
    expect(() => readDwhConfig({ [name]: value })).toThrow(name);
  });

  it.each([
    ["DWH_ENABLED", "yes"],
    ["DWH_SCHEDULED_LOAD_ENABLED", "1"],
    ["DWH_STORE", "file"],
  ])("rejects invalid %s instead of silently disabling SQL", (name, value) => {
    expect(() => readDwhConfig({ [name]: value })).toThrow(name);
  });
});

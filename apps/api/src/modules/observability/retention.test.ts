import { describe, expect, it } from "vitest";
import { readTelemetryRetention, retentionPurgeSql } from "./retention.js";

describe("telemetry retention", () => {
  it("uses documented defaults", () => {
    expect(readTelemetryRetention({})).toEqual({
      rawEventsDays: 7,
      aggregatesDays: 90,
      alertDays: 30,
    });
  });

  it("rejects invalid values before generating SQL", () => {
    expect(() =>
      retentionPurgeSql({ AI_TELEMETRY_RETENTION_RAW_DAYS: "NaN" }),
    ).toThrow(/AI_TELEMETRY_RETENTION_RAW_DAYS/);
    expect(() =>
      retentionPurgeSql({ AI_TELEMETRY_RETENTION_AGG_DAYS: "1; DROP TABLE" }),
    ).toThrow(/AI_TELEMETRY_RETENTION_AGG_DAYS/);
    expect(() =>
      retentionPurgeSql({ AI_TELEMETRY_RETENTION_ALERT_DAYS: "0" }),
    ).toThrow(/AI_TELEMETRY_RETENTION_ALERT_DAYS/);
  });

  it("generates SQL only with validated integer day counts", () => {
    const sql = retentionPurgeSql({
      AI_TELEMETRY_RETENTION_RAW_DAYS: "8",
      AI_TELEMETRY_RETENTION_AGG_DAYS: "91",
      AI_TELEMETRY_RETENTION_ALERT_DAYS: "31",
    });

    expect(sql).toContain("DATEADD(day, -8,");
    expect(sql).toContain("DATEADD(day, -91,");
    expect(sql).toContain("DATEADD(day, -31,");
  });
});

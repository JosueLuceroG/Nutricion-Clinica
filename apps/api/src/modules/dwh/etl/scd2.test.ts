import { describe, expect, it } from "vitest";
import {
  compareScd2SourceOrder,
  decideScd2Transition,
  type Scd2CurrentVersion,
  type Scd2IncomingVersion,
} from "./scd2.js";

function version(value: bigint): Buffer {
  const result = Buffer.alloc(8);
  result.writeBigUInt64BE(value);
  return result;
}

describe.each(["professional", "branch"])("%s intraday SCD2", () => {
  it("preserves 09:00, 13:00 and two rowversion-ordered 17:00 states", () => {
    const states = [
      { label: "A", at: new Date("2026-01-02T09:00:00.000Z"), rv: version(1n) },
      { label: "B", at: new Date("2026-01-02T13:00:00.000Z"), rv: version(2n) },
      { label: "C", at: new Date("2026-01-02T17:00:00.000Z"), rv: version(3n) },
      { label: "D", at: new Date("2026-01-02T17:00:00.000Z"), rv: version(4n) },
    ];
    const history: Array<{
      label: string;
      validFrom: Date;
      validTo: Date | null;
      sourceVersion: Buffer;
    }> = [];

    for (const state of states) {
      const current = history.at(-1);
      const transition = decideScd2Transition({
        current: current
          ? {
              validFrom: current.validFrom,
              sourceUpdatedAt: current.validFrom,
              sourceVersion: current.sourceVersion,
            }
          : null,
        incoming: { sourceUpdatedAt: state.at, sourceVersion: state.rv },
        attributesEqual: current?.label === state.label,
      });
      expect(transition).toBe(current ? "APPEND" : "INSERT");
      if (current) current.validTo = state.at;
      history.push({
        label: state.label,
        validFrom: state.at,
        validTo: null,
        sourceVersion: state.rv,
      });
    }

    expect(history.map((row) => row.label)).toEqual(["A", "B", "C", "D"]);
    expect(history.map((row) => row.validTo?.toISOString() ?? null)).toEqual([
      "2026-01-02T13:00:00.000Z",
      "2026-01-02T17:00:00.000Z",
      "2026-01-02T17:00:00.000Z",
      null,
    ]);
    expect(history.filter((row) => row.validTo === null)).toHaveLength(1);
    for (let index = 1; index < history.length; index += 1) {
      expect(history[index - 1]!.validTo!.getTime()).toBeLessThanOrEqual(
        history[index]!.validFrom.getTime(),
      );
    }

    const current = history.at(-1)!;
    expect(
      decideScd2Transition({
        current: {
          validFrom: current.validFrom,
          sourceUpdatedAt: current.validFrom,
          sourceVersion: current.sourceVersion,
        },
        incoming: {
          sourceUpdatedAt: current.validFrom,
          sourceVersion: current.sourceVersion,
        },
        attributesEqual: true,
      }),
    ).toBe("NOOP");
  });
});

describe("SCD2 source ordering", () => {
  const current: Scd2CurrentVersion = {
    validFrom: new Date("2026-01-02T09:00:00.000Z"),
    sourceUpdatedAt: new Date("2026-01-02T13:00:00.000Z"),
    sourceVersion: version(2n),
  };

  it("uses rowversion as a stable same-timestamp tie-breaker", () => {
    const left: Scd2IncomingVersion = {
      sourceUpdatedAt: new Date("2026-01-02T13:00:00.000Z"),
      sourceVersion: version(3n),
    };
    expect(
      compareScd2SourceOrder(left, {
        sourceUpdatedAt: current.sourceUpdatedAt!,
        sourceVersion: current.sourceVersion!,
      }),
    ).toBeGreaterThan(0);
    expect(
      decideScd2Transition({
        current,
        incoming: left,
        attributesEqual: false,
      }),
    ).toBe("APPEND");
  });

  it("refreshes source metadata for a newer unchanged state", () => {
    expect(
      decideScd2Transition({
        current,
        incoming: {
          sourceUpdatedAt: new Date("2026-01-02T14:00:00.000Z"),
          sourceVersion: version(3n),
        },
        attributesEqual: true,
      }),
    ).toBe("REFRESH_SOURCE");
  });

  it("rejects indistinguishable changes and unsupported out-of-order input", () => {
    expect(() =>
      decideScd2Transition({
        current,
        incoming: {
          sourceUpdatedAt: current.sourceUpdatedAt!,
          sourceVersion: current.sourceVersion!,
        },
        attributesEqual: false,
      }),
    ).toThrow("SCD2_SOURCE_ORDER_NOT_DISTINGUISHABLE");
    expect(() =>
      decideScd2Transition({
        current,
        incoming: {
          sourceUpdatedAt: new Date("2026-01-02T12:00:00.000Z"),
          sourceVersion: version(9n),
        },
        attributesEqual: false,
      }),
    ).toThrow("SCD2_OUT_OF_ORDER_UNSUPPORTED");
  });

  it("adopts legacy metadata without rewriting equal attributes", () => {
    const legacy: Scd2CurrentVersion = {
      validFrom: new Date("2026-01-02T09:00:00.000Z"),
      sourceUpdatedAt: null,
      sourceVersion: null,
    };
    expect(
      decideScd2Transition({
        current: legacy,
        incoming: {
          sourceUpdatedAt: new Date("2026-01-02T13:00:00.000Z"),
          sourceVersion: version(2n),
        },
        attributesEqual: true,
      }),
    ).toBe("REFRESH_SOURCE");
    expect(() =>
      decideScd2Transition({
        current: { ...legacy, sourceVersion: version(1n) },
        incoming: {
          sourceUpdatedAt: new Date("2026-01-02T13:00:00.000Z"),
          sourceVersion: version(2n),
        },
        attributesEqual: true,
      }),
    ).toThrow("SCD2_CURRENT_SOURCE_METADATA_INCOMPLETE");
  });
});

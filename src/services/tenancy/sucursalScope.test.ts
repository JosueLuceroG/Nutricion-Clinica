import { describe, expect, it } from "vitest";
import { rowMatchesSucursal } from "./sucursalScope";

describe("rowMatchesSucursal", () => {
  it("fails closed without an active branch or an explicit row branch", () => {
    expect(rowMatchesSucursal({ sucursal_id: "branch-a" }, null)).toBe(false);
    expect(rowMatchesSucursal({ sucursal_id: null }, "branch-a")).toBe(false);
    expect(rowMatchesSucursal({}, "branch-a")).toBe(false);
  });

  it("compares branch identifiers canonically", () => {
    const branchId = "D2719B2D-7662-4D2E-80B3-322029F82D37";
    expect(rowMatchesSucursal({ sucursal_id: branchId }, branchId.toLowerCase())).toBe(true);
    expect(rowMatchesSucursal({ sucursal_id: branchId }, "branch-b")).toBe(false);
  });
});

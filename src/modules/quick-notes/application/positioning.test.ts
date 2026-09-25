import { describe, expect, it } from "vitest";
import {
  clampNoteToViewport,
  createCascadedDefaultPosition,
  createQuickNoteSize,
  normalizePersistedQuickNoteGeometry,
} from "./positioning";

const viewport = { width: 1000, height: 700 };
const safeRect = { left: 220, top: 64, right: 1000, bottom: 668 };

describe("Quick Note positioning", () => {
  it("clamps notes inside the safe rectangle with an 8px margin", () => {
    const position = clampNoteToViewport(
      {
        x: -500,
        y: 900,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
      },
      createQuickNoteSize("compact"),
      safeRect,
    );

    expect(position.x).toBe(228);
    expect(position.y).toBe(536);
  });

  it("creates deterministic cascaded positions", () => {
    const size = createQuickNoteSize("compact");
    expect(
      createCascadedDefaultPosition(0, size, viewport, safeRect),
    ).toMatchObject({ x: 228, y: 72 });
    expect(
      createCascadedDefaultPosition(2, size, viewport, safeRect),
    ).toMatchObject({ x: 284, y: 128 });
  });

  it("normalizes dimensions and persisted positions for a changed viewport", () => {
    const normalized = normalizePersistedQuickNoteGeometry(
      { x: 900, y: 600, viewportWidth: 1200, viewportHeight: 800 },
      { preset: "regular", width: 999, height: 999 },
      viewport,
      safeRect,
    );

    expect(normalized.size).toEqual({
      preset: "regular",
      width: 520,
      height: 460,
    });
    expect(normalized.position.x).toBe(472);
    expect(normalized.position.y).toBe(200);
  });

  it("migrates legacy preset dimensions and preserves custom sizes", () => {
    expect(
      normalizePersistedQuickNoteGeometry(
        { x: 250, y: 100, viewportWidth: 1000, viewportHeight: 700 },
        { preset: "regular", width: 340, height: 300 },
        viewport,
        safeRect,
      ).size,
    ).toEqual({ preset: "regular", width: 160, height: 164 });

    expect(
      normalizePersistedQuickNoteGeometry(
        { x: 250, y: 100, viewportWidth: 1000, viewportHeight: 700 },
        { preset: "regular", width: 245, height: 210 },
        viewport,
        safeRect,
      ).size,
    ).toEqual({ preset: "regular", width: 245, height: 210 });
  });
});

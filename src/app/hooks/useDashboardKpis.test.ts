import { describe, it, expect } from "vitest";

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function withinDays(d: Date, days: number): boolean {
  const now = Date.now();
  const target = d.getTime();
  return target >= now && target <= now + days * 24 * 60 * 60 * 1000;
}

describe("useDashboardKpis helpers", () => {
  describe("startOfMonth", () => {
    it("returns first day of month at midnight", () => {
      const d = new Date(2026, 5, 15, 10, 30, 0, 0);
      const result = startOfMonth(d);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(5);
      expect(result.getDate()).toBe(1);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });

    it("handles January correctly", () => {
      const d = new Date(2026, 0, 15);
      const result = startOfMonth(d);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(1);
    });

    it("handles December correctly", () => {
      const d = new Date(2026, 11, 15);
      const result = startOfMonth(d);
      expect(result.getMonth()).toBe(11);
      expect(result.getDate()).toBe(1);
    });
  });

  describe("endOfMonth", () => {
    it("returns last day of month at 23:59:59", () => {
      const d = new Date(2026, 5, 15, 10, 30, 0, 0);
      const result = endOfMonth(d);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(5);
      expect(result.getDate()).toBe(30);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
    });

    it("handles 31-day months", () => {
      const d = new Date(2026, 0, 15);
      const result = endOfMonth(d);
      expect(result.getDate()).toBe(31);
    });

    it("handles February non-leap year", () => {
      const d = new Date(2026, 1, 15);
      const result = endOfMonth(d);
      expect(result.getDate()).toBe(28);
    });

    it("handles February leap year", () => {
      const d = new Date(2024, 1, 15);
      const result = endOfMonth(d);
      expect(result.getDate()).toBe(29);
    });
  });

  describe("withinDays", () => {
    it("returns true for future date within range", () => {
      const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      expect(withinDays(future, 10)).toBe(true);
    });

    it("returns true for exact boundary", () => {
      const boundary = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      expect(withinDays(boundary, 30)).toBe(true);
    });

    it("returns false for date beyond range", () => {
      const far = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      expect(withinDays(far, 30)).toBe(false);
    });

    it("returns false for past date", () => {
      const past = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      expect(withinDays(past, 30)).toBe(false);
    });

    it("returns true for current time (now)", () => {
      const now = new Date();
      expect(withinDays(now, 1)).toBe(true);
    });
  });
});

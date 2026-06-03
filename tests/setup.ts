import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
if (!g.crypto) g.crypto = {} as { randomUUID: () => string };
/**
 * Override crypto.randomUUID() to produce UUIDv7-shaped strings with a real
 * millisecond timestamp. The native Node 24 and browser implementations emit
 * UUIDv4, which is rejected by the `*Id.from()` regex in our domain
 * (PatientId, ConsultationId, etc. all expect UUIDv7 per ADR-0006).
 *
 * Tests use this polyfill so the temporal-ordering property holds
 * (sequential `generate()` calls produce lexicographically non-decreasing
 * IDs) and so `from(generate())` roundtrips correctly.
 */
g.crypto.randomUUID = () => {
  const tsHex = Date.now().toString(16).padStart(12, "0");
  const hex = (n: number) =>
    Math.floor(Math.random() * 16 ** n).toString(16).padStart(n, "0");
  return [
    tsHex.slice(0, 8),
    tsHex.slice(8, 12),
    "7" + hex(3),
    ((8 + Math.floor(Math.random() * 4)).toString(16)) + hex(3),
    hex(12),
  ].join("-");
};

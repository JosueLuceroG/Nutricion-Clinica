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
if (!g.crypto?.randomUUID) {
  if (!g.crypto) g.crypto = {} as { randomUUID: () => string };
  g.crypto.randomUUID = () => {
    const hex = (n: number) => Math.floor(Math.random() * 16 ** n).toString(16).padStart(n, "0");
    return [
      hex(8),
      hex(4),
      "7" + hex(3),
      ((8 + Math.floor(Math.random() * 4)).toString(16)) + hex(3),
      hex(12),
    ].join("-");
  };
}

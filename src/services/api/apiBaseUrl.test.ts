import { beforeEach, describe, expect, it } from "vitest";
import { getApiWebSocketUrl } from "./apiBaseUrl.js";

describe("API WebSocket URL", () => {
  beforeEach(() => {
    delete process.env.VITE_API_URL;
  });

  it("resolves a relative /api base against the browser origin", () => {
    process.env.VITE_API_URL = "/api";
    const origin = window.location.origin.replace(/^http:/, "ws:");

    expect(getApiWebSocketUrl("/ws/chat")).toBe(`${origin}/api/ws/chat`);
  });

  it("converts an HTTPS API origin to WSS", () => {
    process.env.VITE_API_URL = "https://api.example.test";

    expect(getApiWebSocketUrl("/ws/chat")).toBe(
      "wss://api.example.test/ws/chat",
    );
  });
});

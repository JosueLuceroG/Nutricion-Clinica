import { describe, expect, it } from "vitest";
import { buildTurnConfig, validIceUrls } from "./turnConfig.js";

describe("buildTurnConfig", () => {
  it("returns no external ICE servers when side effects are disabled", () => {
    const config = buildTurnConfig({});
    expect(config.configured).toBe(false);
    expect(config.iceServers).toEqual([]);
  });

  it("uses custom STUN URLs when provided", () => {
    const config = buildTurnConfig({
      EXTERNAL_SIDE_EFFECTS_MODE: "SANDBOX",
      STUN_URLS: "stun:custom1.example.com,stun:custom2.example.com",
    });
    expect(config.iceServers).toHaveLength(1);
    expect(config.iceServers[0]!.urls).toEqual([
      "stun:custom1.example.com",
      "stun:custom2.example.com",
    ]);
  });

  it("includes TURN servers when configured", () => {
    const config = buildTurnConfig({
      STUN_URLS: "stun:stun.example.com",
      EXTERNAL_SIDE_EFFECTS_MODE: "SANDBOX",
      TURN_URLS: "turn:turn.example.com:3478",
      TURN_USERNAME: "test-user",
      TURN_CREDENTIAL: "test-pass",
    });
    expect(config.configured).toBe(true);
    expect(config.iceServers).toHaveLength(2);
    expect(config.iceServers[1]!.urls).toEqual(["turn:turn.example.com:3478"]);
    expect(config.iceServers[1]!.username).toBe("test-user");
    expect(config.iceServers[1]!.credential).toBe("test-pass");
  });

  it("reports configured=false when no TURN URLs", () => {
    const config = buildTurnConfig({
      EXTERNAL_SIDE_EFFECTS_MODE: "SANDBOX",
      STUN_URLS: "stun:stun.example.com",
    });
    expect(config.configured).toBe(false);
    expect(config.iceServers).toHaveLength(1);
  });

  it("omits partially configured TURN servers", () => {
    const config = buildTurnConfig({
      TURN_URLS: "turn:turn.example.com:3478",
      TURN_USERNAME: "test-user",
      EXTERNAL_SIDE_EFFECTS_MODE: "SANDBOX",
    });
    expect(config.configured).toBe(false);
    expect(config.iceServers).toEqual([]);
  });

  it("issues ephemeral TURN REST credentials in production", () => {
    const config = buildTurnConfig(
      {
        ENVIRONMENT_CLASS: "PRODUCTION",
        EXTERNAL_SIDE_EFFECTS_MODE: "PRODUCTION",
        TURN_URLS: "turns:turn.example.com:5349",
        TURN_SHARED_SECRET: "server-side-shared-secret-value",
        TURN_CREDENTIAL_TTL_SECONDS: "600",
      },
      "user-123",
    );
    expect(config.configured).toBe(true);
    expect(config.iceServers[0]?.username).toMatch(/^\d+:user-123$/);
    expect(config.iceServers[0]?.credential).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it.each(["59", "86401", "1.5", "invalid"])(
    "rejects invalid TURN credential TTL %s",
    (ttl) => {
      expect(() =>
        buildTurnConfig({
          ENVIRONMENT_CLASS: "PRODUCTION",
          EXTERNAL_SIDE_EFFECTS_MODE: "PRODUCTION",
          TURN_URLS: "turns:turn.example.com:5349",
          TURN_SHARED_SECRET: "server-side-shared-secret-value",
          TURN_CREDENTIAL_TTL_SECONDS: ttl,
        }),
      ).toThrow(/TURN_CREDENTIAL_TTL_SECONDS/);
    },
  );

  it("drops ICE URLs with non-ICE schemes", () => {
    const config = buildTurnConfig({
      EXTERNAL_SIDE_EFFECTS_MODE: "SANDBOX",
      STUN_URLS: "https://stun.example.test",
      TURN_URLS: "file:///tmp/relay",
      TURN_USERNAME: "test-user",
      TURN_CREDENTIAL: "test-pass",
    });
    expect(config).toEqual({ configured: false, iceServers: [] });
  });

  it("rejects configured ICE lists without any URL", () => {
    expect(validIceUrls(" , ", "stun")).toBe(false);
    expect(validIceUrls(",,", "turn")).toBe(false);
  });
});

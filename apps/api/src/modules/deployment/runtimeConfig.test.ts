import { describe, expect, it } from "vitest";
import { readServerRuntimeConfig, readTrustProxy } from "./runtimeConfig.js";

describe("deployment runtime config", () => {
  it("uses local-safe defaults", () => {
    expect(readServerRuntimeConfig({})).toEqual({
      bindHost: "127.0.0.1",
      port: 3000,
      trustProxy: false,
      backgroundJobsEnabled: true,
      apiReplicas: 1,
      jobsReplicas: 1,
      shutdownTimeoutMs: 15_000,
    });
  });

  it("accepts a bounded proxy hop count or explicit addresses", () => {
    expect(readTrustProxy("1")).toBe(1);
    expect(readTrustProxy("10.0.0.8/32,fd00::8/128")).toEqual([
      "10.0.0.8/32",
      "fd00::8/128",
    ]);
  });

  it.each(["true", "*", "0.0.0.0/0", "::/0", "17"])(
    "rejects broad proxy trust: %s",
    (value) => {
      expect(() => readTrustProxy(value)).toThrow();
    },
  );

  it("rejects hostnames and invalid CIDR prefixes in proxy allowlists", () => {
    expect(() => readTrustProxy("proxy.internal")).toThrow();
    expect(() => readTrustProxy("10.0.0.8/33")).toThrow();
    expect(() => readTrustProxy("fd00::8/129")).toThrow();
    expect(() => readTrustProxy("10.0.0.8/0")).toThrow();
    expect(() => readTrustProxy("fd00::8/0")).toThrow();
  });

  it("validates bind, port, booleans and shutdown bounds", () => {
    expect(() => readServerRuntimeConfig({ PORT: "0" })).toThrow(/PORT/);
    expect(() =>
      readServerRuntimeConfig({ API_BIND_HOST: "bad host" }),
    ).toThrow(/API_BIND_HOST/);
    expect(() =>
      readServerRuntimeConfig({ BACKGROUND_JOBS_ENABLED: "yes" }),
    ).toThrow(/BACKGROUND_JOBS_ENABLED/);
    expect(() =>
      readServerRuntimeConfig({ SHUTDOWN_TIMEOUT_MS: "50" }),
    ).toThrow(/SHUTDOWN_TIMEOUT_MS/);
  });

  it("keeps local multi-replica simulation available but blocks sensitive environments", () => {
    expect(
      readServerRuntimeConfig({ API_REPLICAS: "2", JOBS_REPLICAS: "3" }),
    ).toMatchObject({ apiReplicas: 2, jobsReplicas: 3 });
    expect(() =>
      readServerRuntimeConfig({
        ENVIRONMENT_CLASS: "STAGING",
        API_REPLICAS: "2",
      }),
    ).toThrow(/MULTI_REPLICA_NOT_CERTIFIED/);
    expect(() =>
      readServerRuntimeConfig({
        ENVIRONMENT_CLASS: "PRODUCTION",
        JOBS_REPLICAS: "2",
      }),
    ).toThrow(/MULTI_REPLICA_NOT_CERTIFIED/);
    expect(() => readServerRuntimeConfig({ API_REPLICAS: "1.5" })).toThrow(
      /INVALID_REPLICA_CONFIGURATION/,
    );
  });
});

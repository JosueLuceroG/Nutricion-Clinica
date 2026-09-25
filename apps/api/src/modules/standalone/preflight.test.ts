import { describe, expect, it } from "vitest";
import {
  runStandalonePreflight,
  validateStandaloneConfiguration,
  type StandalonePreflightDependencies,
} from "./preflight.js";

const validEnv: NodeJS.ProcessEnv = {
  STANDALONE_MODE: "true",
  ENVIRONMENT_CLASS: "LOCAL",
  INSTANCE_ID: "standalone-test-1",
  API_BIND_HOST: "127.0.0.1",
  DB_NAME: "nutriclinica",
  DB_TRUSTED: "true",
  DWH_DATABASE: "nutriclinicadw",
  DWH_TRUSTED: "true",
  DWH_ENABLED: "true",
  DWH_STORE: "sql",
  JWT_SECRET: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJ",
  FIELD_ENCRYPTION_KEY: "abcdefghij0123456789KLMNOPQRSTUVWXYZ",
  AI_PATIENT_ENABLED: "false",
  AI_SHADOW_STATE: "DISABLED",
  AI_MEMORY_ENABLED: "true",
  AI_MEMORY_STORE: "sql",
  AI_RAG_VERSIONED: "true",
  AI_RAG_DOC_STORE: "sql",
  AI_TELEMETRY_STORE: "sql",
  EXTERNAL_SIDE_EFFECTS_MODE: "DISABLED",
  NUTRICLINICA_DATA_ROOT: "C:\\ProgramData\\NutriClinica",
  NUTRICLINICA_BACKUP_ROOT: "D:\\NutriClinicaBackups",
  NUTRICLINICA_LOG_ROOT: "C:\\ProgramData\\NutriClinica\\logs",
  NUTRICLINICA_WEB_ROOT: "C:\\Program Files\\NutriClinica\\web",
};

function dependencies(
  overrides: Partial<StandalonePreflightDependencies> = {},
): StandalonePreflightDependencies {
  return {
    accessPath: async () => undefined,
    probeOltp: async () => undefined,
    probeDwh: async () => undefined,
    probeOltpSchema: async () => ({ current: true, detail: "OLTP schema 039" }),
    probeDwhSchema: async () => ({
      current: true,
      detail: "DWH schema dwh-08-003",
    }),
    ...overrides,
  };
}

describe("standalone preflight", () => {
  it("accepts a local SQL-backed standalone runtime", async () => {
    const report = await runStandalonePreflight(
      validEnv,
      "runtime",
      dependencies(),
    );

    expect(report.ok).toBe(true);
    expect(report.checks.every((check) => check.status === "pass")).toBe(true);
  });

  it("fails closed for shared OLTP/DWH, weak secrets and Patient AI", () => {
    const checks = validateStandaloneConfiguration({
      ...validEnv,
      DWH_DATABASE: "NutriClinica",
      JWT_SECRET: "replace-me",
      AI_PATIENT_ENABLED: "true",
    });

    expect(checks.find((check) => check.id === "sql.separation")?.status).toBe(
      "fail",
    );
    expect(checks.find((check) => check.id === "secrets.jwt")?.status).toBe(
      "fail",
    );
    expect(checks.find((check) => check.id === "ai.patient")?.status).toBe(
      "fail",
    );
  });

  it("allows schema initialization only during install", async () => {
    const schemaMissing = dependencies({
      probeOltpSchema: async () => ({
        current: false,
        detail: "OLTP migrations 0/39",
      }),
      probeDwhSchema: async () => ({
        current: false,
        detail: "DWH schema missing",
      }),
    });

    const install = await runStandalonePreflight(
      validEnv,
      "install",
      schemaMissing,
    );
    const runtime = await runStandalonePreflight(
      validEnv,
      "runtime",
      schemaMissing,
    );

    expect(install.ok).toBe(true);
    expect(
      install.checks.filter((check) => check.id.startsWith("schema.")),
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: "warning" })]),
    );
    expect(runtime.ok).toBe(false);
  });

  it("does not expose probe errors or credentials", async () => {
    const report = await runStandalonePreflight(
      validEnv,
      "runtime",
      dependencies({
        probeOltp: async () => {
          throw new Error("password=synthetic-secret connection failed");
        },
      }),
    );

    expect(JSON.stringify(report)).not.toContain("synthetic-secret");
    expect(
      report.checks.find((check) => check.id === "sql.oltp-connectivity"),
    ).toMatchObject({ status: "fail", detail: "OLTP connection failed" });
  });
});

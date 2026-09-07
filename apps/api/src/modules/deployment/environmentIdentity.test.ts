import { describe, expect, it } from "vitest";
import {
  readEnvironmentClass,
  buildEnvironmentIdentity,
  assertEnvironmentKnown,
  isReleaseVersion,
  isProductionEnvironment,
} from "./environmentIdentity.js";
import {
  assertTargetSafe,
  assertStagingDatabases,
  describeTarget,
  TargetGuardError,
} from "./targetGuard.js";

describe("environmentIdentity (Build 09.5A §4-5)", () => {
  it("ENVIRONMENT_CLASS explícito se respeta", () => {
    expect(readEnvironmentClass({ ENVIRONMENT_CLASS: "staging" })).toBe(
      "STAGING",
    );
    expect(readEnvironmentClass({ ENVIRONMENT_CLASS: "PRODUCTION" })).toBe(
      "PRODUCTION",
    );
    expect(readEnvironmentClass({ ENVIRONMENT_CLASS: "local" })).toBe("LOCAL");
    expect(readEnvironmentClass({ ENVIRONMENT_CLASS: "TEST" })).toBe("TEST");
  });

  it("sin ENVIRONMENT_CLASS: dev local => LOCAL; NODE_ENV=production => UNKNOWN (fail-closed)", () => {
    expect(readEnvironmentClass({})).toBe("LOCAL");
    expect(readEnvironmentClass({ NODE_ENV: "test" })).toBe("LOCAL");
    expect(readEnvironmentClass({ NODE_ENV: "production" })).toBe("UNKNOWN");
    expect(readEnvironmentClass({ ENVIRONMENT_CLASS: "bogus" })).toBe(
      "UNKNOWN",
    );
    expect(
      readEnvironmentClass({
        ENVIRONMENT_CLASS: "bogus",
        NODE_ENV: "production",
      }),
    ).toBe("UNKNOWN");
  });

  it("UNKNOWN bloquea acciones sensibles de despliegue", () => {
    expect(() =>
      assertEnvironmentKnown({ NODE_ENV: "production" }, "rebuild"),
    ).toThrow(/UNKNOWN/);
    expect(() =>
      assertEnvironmentKnown({ ENVIRONMENT_CLASS: "bogus" }, "rebuild"),
    ).toThrow(/UNKNOWN/);
    expect(() => assertEnvironmentKnown({}, "rebuild")).not.toThrow();
  });

  it("identidad: instanceId, targets, flags con defaults seguros", () => {
    const id = buildEnvironmentIdentity({});
    expect(id.environmentClass).toBe("LOCAL");
    expect(id.databaseTarget).toBe("nutriclinica");
    expect(id.dwhTarget).toBe("nutriclinicadw");
    expect(id.aiEnabled).toBe(false);
    expect(id.patientAiAllowed).toBe(false);
    expect(id.shadowAllowed).toBe(false);
    expect(id.production).toBe(false);
  });

  it("identidad nunca expone secretos", () => {
    const marker = "PHI DEPLOYMENT MARKER";
    const id = buildEnvironmentIdentity({
      OPENAI_API_KEY: "sk-secret-x",
      DB_PASSWORD: "pwd",
      ENVIRONMENT_NAME: marker,
      DB_NAME: `Server=db;Password=${marker}`,
      AI_EGRESS_ENABLED: "true",
    });
    const json = JSON.stringify(id);
    expect(json).not.toContain("sk-secret-x");
    expect(json).not.toContain("pwd");
    expect(json).not.toContain(marker);
    expect(id.aiEnabled).toBe(true);
  });

  it("acepta solo versiones de release con SemVer estricto", () => {
    expect(isReleaseVersion("0.1.0-rc.2")).toBe(true);
    expect(isReleaseVersion("01.1.0")).toBe(false);
    expect(isReleaseVersion("0.1.0-01")).toBe(false);
    expect(isReleaseVersion("0.1.0-alpha.")).toBe(false);
    expect(isReleaseVersion("0.1.0+build.1")).toBe(false);
  });
});

describe("targetGuard (Build 09.5A §6, §26-28, §48)", () => {
  const migrationPreflight = {
    NODE_ENV: "production",
    WORKLOAD_ROLE: "migration",
    DB_ENCRYPT: "true",
    DB_TRUST_CERT: "false",
    DB_SERVER: "sql.internal",
    DB_PASSWORD: "9vR2kL7mQ4xN8sC5pT1w",
    DEPLOYMENT_ID: "deploy-2026-001",
    RELEASE_VERSION: "0.1.0-rc.1",
    GIT_COMMIT: "a".repeat(40),
    SECRET_SCAN_STATUS: "PASS",
    SECRET_SCAN_COMMIT: "a".repeat(40),
    SECRET_SCAN_EVIDENCE_ID: "ci-run-123",
    API_ARTIFACT_DIGEST: `sha256:${"b".repeat(64)}`,
    API_ARTIFACT: `registry/nutriclinica-api@sha256:${"b".repeat(64)}`,
    CHANGE_REQUEST_ID: "CR-2026-001",
    BACKUP_RESTORE_ATTESTED: "true",
    ROLLBACK_ARTIFACT_DIGEST: `sha256:${"c".repeat(64)}`,
  };

  it("PRODUCTION: acciones destructivas fail-closed sin ALLOW_PRODUCTION_*", () => {
    const env = { ENVIRONMENT_CLASS: "PRODUCTION" };
    expect(() => assertTargetSafe("migrate", env)).toThrow(
      /ALLOW_PRODUCTION_MIGRATE/,
    );
    expect(() => assertTargetSafe("seed", env)).toThrow(
      /ALLOW_PRODUCTION_SEED/,
    );
    expect(() => assertTargetSafe("reset", env)).toThrow(
      /ALLOW_PRODUCTION_RESET/,
    );
    expect(() => assertTargetSafe("rebuild", env)).toThrow(
      /ALLOW_PRODUCTION_REBUILD/,
    );
    expect(() => assertTargetSafe("drop", env)).toThrow(
      /ALLOW_PRODUCTION_DROP/,
    );
  });

  it("PRODUCTION: ALLOW_PRODUCTION_* explícito permite (con bases no locales)", () => {
    const env = {
      ENVIRONMENT_CLASS: "PRODUCTION",
      ALLOW_PRODUCTION_MIGRATE: "true",
      DB_NAME: "nc_prod_oltp",
      DWH_DATABASE: "nc_prod_dwh",
      ...migrationPreflight,
    };
    expect(() => assertTargetSafe("migrate", env)).not.toThrow();
  });

  it("UNKNOWN: siempre fail-closed", () => {
    expect(() =>
      assertTargetSafe("migrate", { NODE_ENV: "production" }),
    ).toThrow(TargetGuardError);
  });

  it("STAGING no puede apuntar a bases por defecto locales ni mezclar OLTP/DWH", () => {
    const env = {
      ENVIRONMENT_CLASS: "STAGING",
      DB_NAME: "nutriclinica",
      DWH_DATABASE: "nutriclinicadw",
    };
    expect(() => assertTargetSafe("migrate", env)).toThrow(/por defecto/);
    const same = {
      ENVIRONMENT_CLASS: "STAGING",
      DB_NAME: "nc_stg",
      DWH_DATABASE: "nc_stg",
    };
    expect(() => assertTargetSafe("migrate", same)).toThrow(/misma base/);
    const missing = { ENVIRONMENT_CLASS: "STAGING", DB_NAME: "nc_stg" };
    expect(() => assertStagingDatabases(missing)).toThrow(/explicitos/);
    const ok = {
      ENVIRONMENT_CLASS: "STAGING",
      DB_NAME: "nc_stg_oltp",
      DWH_DATABASE: "nc_stg_dwh",
      ...migrationPreflight,
    };
    expect(() => assertTargetSafe("migrate", ok)).not.toThrow();
  });

  it("LOCAL/TEST permiten migraciones (desarrollo local)", () => {
    expect(() =>
      assertTargetSafe("migrate", { ENVIRONMENT_CLASS: "LOCAL" }),
    ).not.toThrow();
    expect(() =>
      assertTargetSafe("migrate", { ENVIRONMENT_CLASS: "TEST" }),
    ).not.toThrow();
  });

  it("STAGING valida preflight por rol para schema DWH y maintenance", () => {
    const base = {
      ENVIRONMENT_CLASS: "STAGING",
      DB_NAME: "nc_stg_oltp",
      DWH_DATABASE: "nc_stg_dwh",
      ...migrationPreflight,
    };
    expect(() => assertTargetSafe("maintenance", base)).not.toThrow();
    expect(() =>
      assertTargetSafe("dwh_schema", {
        ...base,
        WORKLOAD_ROLE: "dwh-schema",
        DWH_SERVER: "dwh.internal",
        DWH_ENCRYPT: "true",
        DWH_TRUST_CERT: "false",
        DWH_PASSWORD: "7pR4mN9xQ2vL8sK5cT1z",
      }),
    ).not.toThrow();
    expect(() =>
      assertTargetSafe("dwh_schema", {
        ...base,
        WORKLOAD_ROLE: "migration",
      }),
    ).toThrow(/WORKLOAD_ROLE=dwh-schema/);
  });

  it("STAGING exige autorizacion explicita y preflight para seed/reset/drop", () => {
    const base = {
      ENVIRONMENT_CLASS: "STAGING",
      DB_NAME: "nc_stg_oltp",
      DWH_DATABASE: "nc_stg_dwh",
      ...migrationPreflight,
    };
    expect(() => assertTargetSafe("reset", base)).toThrow(
      /ALLOW_STAGING_RESET/,
    );
    expect(() =>
      assertTargetSafe("reset", { ...base, ALLOW_STAGING_RESET: "true" }),
    ).not.toThrow();
    expect(() =>
      assertTargetSafe("seed", { ...base, ALLOW_STAGING_SEED: "true" }),
    ).not.toThrow();
  });

  it("PRODUCTION no omite el preflight aunque ALLOW_PRODUCTION este activo", () => {
    expect(() =>
      assertTargetSafe("reset", {
        ENVIRONMENT_CLASS: "PRODUCTION",
        DB_NAME: "nc_prod_oltp",
        DWH_DATABASE: "nc_prod_dwh",
        ALLOW_PRODUCTION_RESET: "true",
      }),
    ).toThrow(/NODE_ENV=production/);
  });

  it("one-shots rechazan referencias de evidencia sinteticas", () => {
    expect(() =>
      assertTargetSafe("migrate", {
        ENVIRONMENT_CLASS: "STAGING",
        DB_NAME: "nc_stg_oltp",
        DWH_DATABASE: "nc_stg_dwh",
        ...migrationPreflight,
        SECRET_SCAN_EVIDENCE_ID: "PHI_DEPLOYMENT_MARKER_6f6db2",
      }),
    ).toThrow(/scan de secretos/);
  });

  it("describeTarget reporta el objetivo sin exponer credenciales", () => {
    const target = describeTarget({
      ENVIRONMENT_CLASS: "STAGING",
      DB_NAME: "nc_stg_oltp",
      DWH_DATABASE: "nc_stg_dwh",
      DB_PASSWORD: "x",
    });
    expect(target.oltp).toBe("nc_stg_oltp");
    expect(target.dwh).toBe("nc_stg_dwh");
    expect(JSON.stringify(target)).not.toContain("x");
    expect(isProductionEnvironment({ ENVIRONMENT_CLASS: "PRODUCTION" })).toBe(
      true,
    );
  });
});

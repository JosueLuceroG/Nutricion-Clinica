import { describe, expect, it } from "vitest";
import {
  validateStartupConfig,
  assertStartupConfigValid,
} from "./startupValidation.js";

describe("startupValidation (Build 09.5A §16-18, §35-38, §73)", () => {
  it("dev local sin flags: sin errores (solo warnings permitidos)", () => {
    const issues = validateStartupConfig({}, {});
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("NODE_ENV=production sin ENVIRONMENT_CLASS: fail-fast", () => {
    const issues = validateStartupConfig({ NODE_ENV: "production" });
    expect(
      issues.some((i) => i.severity === "error" && i.group === "environment"),
    ).toBe(true);
    expect(() => assertStartupConfigValid({ NODE_ENV: "production" })).toThrow(
      /fail-fast/,
    );
  });

  it("STAGING/PRODUCTION no pueden usar bases por defecto locales", () => {
    const issues = validateStartupConfig({
      ENVIRONMENT_CLASS: "STAGING",
      DB_NAME: "nutriclinica",
      DWH_DATABASE: "nutriclinicadw",
    });
    expect(
      issues.some((i) => i.message.includes("bases por defecto locales")),
    ).toBe(true);
  });

  it("STAGING/PRODUCTION rechazan CORS comodín", () => {
    const issues = validateStartupConfig({
      ENVIRONMENT_CLASS: "STAGING",
      DB_NAME: "nc_stg_oltp",
      DWH_DATABASE: "nc_stg_dwh",
      CORS_ORIGIN: "*",
    });
    expect(issues.some((i) => i.message.includes("comodín"))).toBe(true);
    const ok = validateStartupConfig({
      ENVIRONMENT_CLASS: "STAGING",
      DB_NAME: "nc_stg_oltp",
      DWH_DATABASE: "nc_stg_dwh",
      CORS_ORIGIN: "https://app.example.com",
    });
    expect(
      ok.filter((i) => i.severity === "error" && i.message.includes("comodín")),
    ).toEqual([]);
  });

  it("STAGING/PRODUCTION rechazan loopback y hosts unspecified", () => {
    const issues = validateStartupConfig({
      ENVIRONMENT_CLASS: "STAGING",
      DB_NAME: "nc_stg_oltp",
      DWH_DATABASE: "nc_stg_dwh",
      CORS_ORIGIN: "https://localhost.",
      PUBLIC_API_URL: "https://0.0.0.0",
      PUBLIC_WEB_URL: "https://127.0.0.2",
    });
    expect(
      issues.filter(
        (issue) =>
          issue.message.includes("URL HTTPS remota") ||
          issue.message.includes("CORS_ORIGIN no aprobado"),
      ).length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("DWH apuntando al mismo OLTP: error (fail-closed)", () => {
    const issues = validateStartupConfig({
      DWH_ENABLED: "true",
      DB_NAME: "same",
      DWH_DATABASE: "same",
    });
    expect(
      issues.some((i) => i.severity === "error" && i.group === "dwh"),
    ).toBe(true);
  });

  it("kill switches con valores inválidos: fail-fast", () => {
    expect(() => assertStartupConfigValid({ AI_EGRESS_ENABLED: "si" })).toThrow(
      /AI_EGRESS_ENABLED/,
    );
    expect(() =>
      assertStartupConfigValid({ AI_PATIENT_ENABLED: "yes" }),
    ).toThrow(/AI_PATIENT_ENABLED/);
    expect(() =>
      assertStartupConfigValid({ RETENTION_CLEANUP_DRY_RUN: "yes" }),
    ).toThrow(/RETENTION_CLEANUP_DRY_RUN/);
  });

  it("shadow state inválido y stores inválidos: fail-fast", () => {
    expect(() =>
      assertStartupConfigValid({ AI_SHADOW_STATE: "RANDOM" }),
    ).toThrow(/AI_SHADOW_STATE/);
    expect(() =>
      assertStartupConfigValid({ AI_TELEMETRY_STORE: "file" }),
    ).toThrow(/AI_TELEMETRY_STORE/);
    expect(() =>
      assertStartupConfigValid({ AI_CERTIFICATION_STORE: "file" }),
    ).toThrow(/AI_CERTIFICATION_STORE/);
    expect(() =>
      assertStartupConfigValid({ AI_CLINICAL_REVIEW_STORE: "file" }),
    ).toThrow(/AI_CLINICAL_REVIEW_STORE/);
    expect(() =>
      assertStartupConfigValid({ AI_PROVIDER: "unknown-provider" }),
    ).toThrow(/AI_PROVIDER/);
  });

  it("configuración clínica malformada: fail-fast", () => {
    expect(() =>
      assertStartupConfigValid({ AI_SHADOW_SAMPLE_RATE: "2.5" }),
    ).toThrow(/AI_SHADOW_SAMPLE_RATE/);
    expect(() =>
      assertStartupConfigValid({ AI_EXPERT_ENABLED: "yes" }),
    ).toThrow(/AI_EXPERT_ENABLED/);
    expect(() =>
      assertStartupConfigValid({ AI_SHADOW_MODE_ENABLED: "1" }),
    ).toThrow(/AI_SHADOW_MODE_ENABLED/);
    expect(() =>
      assertStartupConfigValid({ AI_QUALIFICATION_ENFORCED: "yes" }),
    ).toThrow(/AI_QUALIFICATION_ENFORCED/);
    expect(() =>
      assertStartupConfigValid({ AI_CLINICAL_DISAGREEMENT_THRESHOLD: "1.5" }),
    ).toThrow(/AI_CLINICAL_DISAGREEMENT_THRESHOLD/);
    expect(() =>
      assertStartupConfigValid({ AI_CLINICAL_WINDOW_DAYS: "0" }),
    ).toThrow(/AI_CLINICAL_WINDOW_DAYS/);
  });

  it("configuración de tamaño y retención de telemetría malformada: fail-fast", () => {
    expect(() =>
      assertStartupConfigValid({ AI_TELEMETRY_MAX_EVENT_BYTES: "NaN" }),
    ).toThrow(/AI_TELEMETRY_MAX_EVENT_BYTES/);
    expect(() =>
      assertStartupConfigValid({ AI_TELEMETRY_RETENTION_RAW_DAYS: "0" }),
    ).toThrow(/AI_TELEMETRY_RETENTION_RAW_DAYS/);
    expect(() =>
      assertStartupConfigValid({ AI_TELEMETRY_RETENTION_AGG_DAYS: "1.5" }),
    ).toThrow(/AI_TELEMETRY_RETENTION_AGG_DAYS/);
    expect(() =>
      assertStartupConfigValid({
        AI_TELEMETRY_RETENTION_ALERT_DAYS: "Infinity",
      }),
    ).toThrow(/AI_TELEMETRY_RETENTION_ALERT_DAYS/);
  });

  it("rechaza configuración TURN y alertas que desactivaría controles", () => {
    expect(() =>
      assertStartupConfigValid({ TURN_CREDENTIAL_TTL_SECONDS: "59" }),
    ).toThrow(/TURN_CREDENTIAL_TTL_SECONDS/);
    expect(() =>
      assertStartupConfigValid({ AI_TELEMETRY_ALERT_BREAKER_OPENED: "yes" }),
    ).toThrow(/AI_TELEMETRY_ALERT_BREAKER_OPENED/);
    expect(() =>
      assertStartupConfigValid({
        AI_TELEMETRY_ALERT_CITATION_VALIDITY_MIN: "NaN",
      }),
    ).toThrow(/AI_TELEMETRY_ALERT_CITATION_VALIDITY_MIN/);
    expect(() =>
      assertStartupConfigValid({
        AI_TELEMETRY_ALERT_CRITICAL_DISAGREEMENT: "0",
      }),
    ).toThrow(/AI_TELEMETRY_ALERT_CRITICAL_DISAGREEMENT/);
  });

  it("configuración numérica DWH malformada: fail-fast", () => {
    expect(() =>
      assertStartupConfigValid({ DWH_LOAD_WINDOW_DAYS: "2.5" }),
    ).toThrow(/DWH_LOAD_WINDOW_DAYS/);
    expect(() =>
      assertStartupConfigValid({ DWH_MAX_FRESHNESS_DAYS: "NaN" }),
    ).toThrow(/DWH_MAX_FRESHNESS_DAYS/);
    expect(() => assertStartupConfigValid({ DWH_SMALL_CELL_MIN: "0" })).toThrow(
      /DWH_SMALL_CELL_MIN/,
    );
    expect(() => assertStartupConfigValid({ DWH_STORE: "file" })).toThrow(
      /DWH_STORE/,
    );
  });

  it("PRODUCTION con contraseña vacía: fail-fast", () => {
    const issues = validateStartupConfig({
      ENVIRONMENT_CLASS: "PRODUCTION",
      DB_NAME: "nc_prod_oltp",
      DWH_DATABASE: "nc_prod_dwh",
      DB_PASSWORD: "",
    });
    expect(issues.some((i) => i.message.includes("contraseña vacía"))).toBe(
      true,
    );
  });

  it("AI_PATIENT_ENABLED=true: warning, no error (el gate clínico bloquea igual)", () => {
    const issues = validateStartupConfig({ AI_PATIENT_ENABLED: "true" });
    expect(
      issues.some(
        (i) =>
          i.severity === "warning" && i.message.includes("AI_PATIENT_ENABLED"),
      ),
    ).toBe(true);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("STAGING exige red, TLS SQL, identidad, secretos y side effects seguros", () => {
    const issues = validateStartupConfig({
      ENVIRONMENT_CLASS: "STAGING",
      DB_NAME: "nc_stg_oltp",
      DWH_DATABASE: "nc_stg_dwh",
      CORS_ORIGIN: "https://web.staging.nutriclinica.mx",
      EXTERNAL_SIDE_EFFECTS_MODE: "PRODUCTION",
      AI_PATIENT_ENABLED: "true",
    });
    expect(issues.some((i) => i.message.includes("PUBLIC_API_URL"))).toBe(true);
    expect(issues.some((i) => i.message.includes("DB_ENCRYPT=true"))).toBe(
      true,
    );
    expect(issues.some((i) => i.message.includes("efectos externos"))).toBe(
      true,
    );
    expect(issues.some((i) => i.message.includes("AI_PATIENT_ENABLED"))).toBe(
      true,
    );
  });

  it("acepta contrato de STAGING completo sin habilitar Patient AI", () => {
    const issues = validateStartupConfig({
      NODE_ENV: "production",
      ENVIRONMENT_CLASS: "STAGING",
      ENVIRONMENT_NAME: "staging-example",
      DEPLOYMENT_ID: "deploy-example-1",
      WORKLOAD_ROLE: "api",
      API_BIND_HOST: "0.0.0.0",
      PORT: "3000",
      TRUST_PROXY: "1",
      BACKGROUND_JOBS_ENABLED: "false",
      PUBLIC_API_URL: "https://api.staging.nutriclinica.mx",
      PUBLIC_WEB_URL: "https://web.staging.nutriclinica.mx",
      DB_SERVER: "sql.internal",
      DB_NAME: "nc_stg_oltp",
      DWH_DATABASE: "nc_stg_dwh",
      DB_ENCRYPT: "true",
      DB_TRUST_CERT: "false",
      DWH_ENCRYPT: "",
      DWH_TRUST_CERT: "",
      DB_USER: "app_user",
      DB_PASSWORD: "9vR2kL7mQ4xN8sC5pT1w",
      JWT_SECRET: "7zQ9pL2nR8vK5mX4cD6hB3sW1kP0qZ8uN2fG5jH",
      FIELD_ENCRYPTION_KEY: "3uN6hB9sW2kP7qZ5vC8mR1xD4jL0tF6aY9gE2iO",
      CORS_ORIGIN: "https://web.staging.nutriclinica.mx,tauri://localhost",
      INSTANCE_ID: "staging-api-1",
      RELEASE_VERSION: "0.1.0-rc.1",
      DESKTOP_RELEASE_VERSION: "0.1.0-rc.1",
      GIT_COMMIT: "a".repeat(40),
      SECRET_SCAN_STATUS: "PASS",
      SECRET_SCAN_COMMIT: "a".repeat(40),
      SECRET_SCAN_EVIDENCE_ID: "ci-run-123",
      API_ARTIFACT: `registry/nutriclinica-api@sha256:${"b".repeat(64)}`,
      API_ARTIFACT_DIGEST: `sha256:${"b".repeat(64)}`,
      WEB_ARTIFACT: `registry/nutriclinica-web@sha256:${"c".repeat(64)}`,
      WEB_ARTIFACT_DIGEST: `sha256:${"c".repeat(64)}`,
      EXTERNAL_SIDE_EFFECTS_MODE: "DISABLED",
      AI_PATIENT_ENABLED: "false",
      AI_TELEMETRY_STORE: "sql",
      AI_CERTIFICATION_STORE: "sql",
      AI_CLINICAL_REVIEW_STORE: "sql",
    });
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("STAGING/PRODUCTION exigen stores SQL para evidencia clínica", () => {
    const issues = validateStartupConfig({
      ENVIRONMENT_CLASS: "STAGING",
      AI_TELEMETRY_STORE: "memory",
      AI_CERTIFICATION_STORE: "memory",
      AI_CLINICAL_REVIEW_STORE: "memory",
    });
    expect(
      issues.some((issue) => issue.message.includes("AI_TELEMETRY_STORE=sql")),
    ).toBe(true);
    expect(
      issues.some((issue) =>
        issue.message.includes("AI_CERTIFICATION_STORE=sql"),
      ),
    ).toBe(true);
    expect(
      issues.some((issue) =>
        issue.message.includes("AI_CLINICAL_REVIEW_STORE=sql"),
      ),
    ).toBe(true);
  });

  it("STAGING/PRODUCTION mantienen calificación y shadow clínico fail-closed", () => {
    const issues = validateStartupConfig({
      ENVIRONMENT_CLASS: "STAGING",
      AI_QUALIFICATION_ENFORCED: "false",
      AI_SHADOW_MODE_ENABLED: "true",
    });
    expect(
      issues.some((issue) =>
        issue.message.includes("AI_QUALIFICATION_ENFORCED"),
      ),
    ).toBe(true);
    expect(
      issues.some((issue) => issue.message.includes("AI_SHADOW_MODE_ENABLED")),
    ).toBe(true);
  });

  it("STAGING/PRODUCTION rechazan drift de version Desktop", () => {
    const issues = validateStartupConfig({
      ENVIRONMENT_CLASS: "STAGING",
      RELEASE_VERSION: "0.1.0-rc.2",
      DESKTOP_RELEASE_VERSION: "0.1.0-rc.1",
    });
    expect(
      issues.some((issue) => issue.message.includes("DESKTOP_RELEASE_VERSION")),
    ).toBe(true);
  });

  it("rechaza secretos triviales y placeholders aunque tengan longitud suficiente", () => {
    const common = {
      ENVIRONMENT_CLASS: "STAGING",
      DB_NAME: "nc_stg_oltp",
      DWH_DATABASE: "nc_stg_dwh",
      DB_PASSWORD: "4mK8vR2pT9xN6sC1qW7z",
    };
    const issues = validateStartupConfig({
      ...common,
      JWT_SECRET: "x".repeat(64),
      FIELD_ENCRYPTION_KEY: "replace-this-with-a-secret-value-123456",
    });
    expect(issues.filter((i) => i.group === "secret")).toHaveLength(2);
  });

  it("valida jobs por rol sin exigir secretos HTTP y rechaza jobs embebidos en API", () => {
    const shared = {
      NODE_ENV: "production",
      ENVIRONMENT_CLASS: "STAGING",
      ENVIRONMENT_NAME: "staging-example",
      INSTANCE_ID: "staging-jobs-1",
      DEPLOYMENT_ID: "deploy-example-1",
      DB_SERVER: "sql.internal",
      DB_NAME: "nc_stg_oltp",
      DWH_DATABASE: "nc_stg_dwh",
      DB_ENCRYPT: "true",
      DB_TRUST_CERT: "false",
      DB_PASSWORD: "4mK8vR2pT9xN6sC1qW7z",
      RELEASE_VERSION: "0.1.0-rc.1",
      DESKTOP_RELEASE_VERSION: "0.1.0-rc.1",
      GIT_COMMIT: "a".repeat(40),
      SECRET_SCAN_STATUS: "PASS",
      SECRET_SCAN_COMMIT: "a".repeat(40),
      SECRET_SCAN_EVIDENCE_ID: "ci-run-123",
      API_ARTIFACT: `registry/nutriclinica-api@sha256:${"b".repeat(64)}`,
      API_ARTIFACT_DIGEST: `sha256:${"b".repeat(64)}`,
      WEB_ARTIFACT: `registry/nutriclinica-web@sha256:${"c".repeat(64)}`,
      WEB_ARTIFACT_DIGEST: `sha256:${"c".repeat(64)}`,
      EXTERNAL_SIDE_EFFECTS_MODE: "DISABLED",
      AI_EGRESS_ENABLED: "false",
      AI_PATIENT_ENABLED: "false",
      AI_SHADOW_STATE: "DISABLED",
      AI_TELEMETRY_STORE: "sql",
      AI_CERTIFICATION_STORE: "sql",
      AI_CLINICAL_REVIEW_STORE: "sql",
    };
    const jobs = validateStartupConfig(
      {
        ...shared,
        WORKLOAD_ROLE: "jobs",
        BACKGROUND_JOBS_ENABLED: "true",
      },
      { role: "jobs" },
    );
    expect(jobs.filter((issue) => issue.severity === "error")).toEqual([]);

    const api = validateStartupConfig(
      {
        ...shared,
        WORKLOAD_ROLE: "api",
        BACKGROUND_JOBS_ENABLED: "true",
      },
      { role: "api" },
    );
    expect(
      api.some((issue) => issue.message.includes("runner jobs dedicado")),
    ).toBe(true);
  });

  it("rechaza identidad, puertos y SQL Auth incompletos fuera de local", () => {
    const issues = validateStartupConfig({
      ENVIRONMENT_CLASS: "STAGING",
      DB_NAME: "nc_stg_oltp",
      DWH_DATABASE: "nc_stg_dwh",
      DB_PORT: "1433.5",
      DWH_PORT: "70000",
      DB_PASSWORD: "",
    });
    expect(issues.some((i) => i.message.includes("DB_PORT"))).toBe(true);
    expect(issues.some((i) => i.message.includes("DWH_PORT"))).toBe(true);
    expect(issues.some((i) => i.message.includes("ENVIRONMENT_NAME"))).toBe(
      true,
    );
    expect(issues.some((i) => i.message.includes("DB_PASSWORD"))).toBe(true);
  });

  it("PRODUCTION email mode requiere SMTP completo al arrancar", () => {
    const issues = validateStartupConfig({
      ENVIRONMENT_CLASS: "PRODUCTION",
      EXTERNAL_SIDE_EFFECTS_MODE: "PRODUCTION",
    });
    expect(issues.some((i) => i.message.includes("SMTP_HOST"))).toBe(true);
    expect(issues.some((i) => i.message.includes("SMTP_PASS"))).toBe(true);
  });

  it("rechaza endpoints con credenciales o paths e ICE con schemes ajenos", () => {
    const issues = validateStartupConfig({
      ENVIRONMENT_CLASS: "STAGING",
      DB_NAME: "nc_stg_oltp",
      DWH_DATABASE: "nc_stg_dwh",
      PUBLIC_API_URL:
        "https://user:password@api.staging.nutriclinica.mx/private",
      PUBLIC_WEB_URL: "https://web.staging.nutriclinica.mx",
      EXTERNAL_SIDE_EFFECTS_MODE: "SANDBOX",
      STUN_URLS: "https://stun.example.test",
      TURN_URLS: "https://turn.example.test",
    });
    expect(issues.some((i) => i.message.includes("PUBLIC_API_URL"))).toBe(true);
    expect(issues.some((i) => i.message.includes("STUN_URLS"))).toBe(true);
    expect(issues.some((i) => i.message.includes("TURN_URLS"))).toBe(true);
  });

  it("rechaza endpoints reservados para documentación", () => {
    const issues = validateStartupConfig({
      ENVIRONMENT_CLASS: "STAGING",
      DB_NAME: "nc_stg_oltp",
      DWH_DATABASE: "nc_stg_dwh",
      PUBLIC_API_URL: "https://api.example.test",
      PUBLIC_WEB_URL: "https://web.invalid",
    });
    expect(issues.some((i) => i.message.includes("PUBLIC_API_URL"))).toBe(true);
    expect(issues.some((i) => i.message.includes("PUBLIC_WEB_URL"))).toBe(true);
  });

  it("bloquea cleanup destructivo de jobs sin revisión de legal hold", () => {
    const issues = validateStartupConfig(
      {
        ENVIRONMENT_CLASS: "STAGING",
        DB_NAME: "nc_stg_oltp",
        DWH_DATABASE: "nc_stg_dwh",
        WORKLOAD_ROLE: "jobs",
        BACKGROUND_JOBS_ENABLED: "true",
        RETENTION_CLEANUP_ENABLED: "true",
        RETENTION_CLEANUP_DRY_RUN: "false",
      },
      { role: "jobs" },
    );
    expect(issues.some((i) => i.group === "retention")).toBe(true);
  });
});

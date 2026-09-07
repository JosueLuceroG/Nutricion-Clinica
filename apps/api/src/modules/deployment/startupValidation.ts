import { assertDwhDatabaseSeparate } from "../dwh/config.js";
import {
  isReleaseVersion,
  readEnvironmentClass,
} from "./environmentIdentity.js";
import { DEFAULT_OLTP_DB, DEFAULT_DWH_DB } from "./targetGuard.js";
import { SHADOW_STATES } from "../shadow/shadowStateMachine.js";
import { readServerRuntimeConfig } from "./runtimeConfig.js";
import { readExternalSideEffectMode } from "./externalSideEffects.js";
import { assertWorkloadRole, type WorkloadRole } from "./workloadRole.js";
import { validIceUrls } from "../telemedicina/turnConfig.js";
import { isSafeEvidenceReference } from "./deploymentEvidence.js";

/**
 * Validación central de arranque (Build 09.5A §16-18, §35-38, §73).
 * Fail-fast: cualquier issue 'error' impide el arranque del servidor.
 * En STAGING/PRODUCTION el entorno debe declararse explícitamente y no
 * apuntar a bases locales por defecto; CORS no puede ser comodín.
 */

export interface StartupIssue {
  group: string;
  severity: "error" | "warning";
  message: string;
}

function parseBoolean(
  value: string | undefined,
  fallback: boolean,
): boolean | null {
  if (value === undefined || value.trim() === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function configured(
  primary: string | undefined,
  fallback?: string,
): string | undefined {
  if (primary?.trim()) return primary;
  if (fallback?.trim()) return fallback;
  return undefined;
}

function parseNumberInRange(
  value: string | undefined,
  min: number,
  max: number,
  label: string,
  issues: StartupIssue[],
): void {
  if (value === undefined || value.trim() === "") return;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    issues.push({
      group: "config",
      severity: "error",
      message: `${label}: se esperaba número entre ${min} y ${max}, recibido '${value}'`,
    });
  }
}

function parseIntegerInRange(
  value: string | undefined,
  min: number,
  max: number,
  label: string,
  issues: StartupIssue[],
): void {
  if (value === undefined || value.trim() === "") return;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    issues.push({
      group: "config",
      severity: "error",
      message: `${label}: se esperaba entero entre ${min} y ${max}, recibido '${value}'`,
    });
  }
}

function parsePositiveInteger(
  value: string | undefined,
  label: string,
  issues: StartupIssue[],
): void {
  if (value === undefined || value.trim() === "") return;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    issues.push({
      group: "config",
      severity: "error",
      message: `${label}: se esperaba entero >= 1, recibido '${value}'`,
    });
  }
}

function requireHttpsUrl(
  value: string | undefined,
  label: string,
  issues: StartupIssue[],
): void {
  const raw = value?.trim();
  if (!raw) {
    issues.push({
      group: "network",
      severity: "error",
      message: `${label} es obligatorio`,
    });
    return;
  }
  try {
    const parsed = new URL(raw);
    if (
      parsed.protocol !== "https:" ||
      unsafeRemoteHostname(parsed.hostname) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error("remote HTTPS required");
    }
  } catch {
    issues.push({
      group: "network",
      severity: "error",
      message: `${label} debe ser URL HTTPS remota valida`,
    });
  }
}

function unsafeRemoteHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host.endsWith(".") ||
    /(?:^|\.)(?:example|invalid|test)$/.test(host) ||
    /^(?:.+\.)?example\.(?:com|net|org)$/.test(host) ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    /^127\./.test(host) ||
    host === "[::]" ||
    host === "[::1]" ||
    /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}\]$/.test(host)
  );
}

function requireRuntimeSecret(
  value: string | undefined,
  minimum: number,
  label: string,
  issues: StartupIssue[],
): void {
  const secret = value?.trim() ?? "";
  const looksLikePlaceholder =
    /(change|replace|reemplaz|example|sample|placeholder|injected|todo)/i.test(
      secret,
    );
  if (
    secret.length < minimum ||
    new Set(secret).size < 8 ||
    looksLikePlaceholder
  ) {
    issues.push({
      group: "secret",
      severity: "error",
      message: `${label} debe ser un secreto aleatorio inyectado con al menos ${minimum} caracteres`,
    });
  }
}

function validDigestBoundArtifact(
  id: string | undefined,
  digest: string | undefined,
): boolean {
  const artifactId = id?.trim() ?? "";
  const artifactDigest = digest?.trim() ?? "";
  const suffix = `@${artifactDigest}`;
  if (
    !/^sha256:[0-9a-f]{64}$/i.test(artifactDigest) ||
    !artifactId.endsWith(suffix)
  )
    return false;
  return /^[A-Za-z0-9][A-Za-z0-9._/:+-]{0,299}$/.test(
    artifactId.slice(0, -suffix.length),
  );
}

export interface StartupValidationDeps {
  role?: WorkloadRole;
  ai?: {
    validate: (
      env: NodeJS.ProcessEnv,
    ) => { severity: "error" | "warning"; message: string }[];
  };
}

export function validateStartupConfig(
  env: NodeJS.ProcessEnv = process.env,
  deps: StartupValidationDeps = {},
): StartupIssue[] {
  const issues: StartupIssue[] = [];
  const environmentClass = readEnvironmentClass(env);
  const role = deps.role ?? "api";

  try {
    assertWorkloadRole(role, env);
  } catch (err) {
    issues.push({
      group: "workload",
      severity: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }

  if (environmentClass === "UNKNOWN") {
    issues.push({
      group: "environment",
      severity: "error",
      message:
        "ENVIRONMENT_CLASS inválido o ausente con NODE_ENV=production: arranque fail-closed",
    });
  }

  if (role === "api") {
    try {
      readServerRuntimeConfig(env);
    } catch (err) {
      issues.push({
        group: "runtime",
        severity: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const externalSideEffects = readExternalSideEffectMode(env);
  if (externalSideEffects === "UNKNOWN") {
    issues.push({
      group: "external",
      severity: "error",
      message:
        "EXTERNAL_SIDE_EFFECTS_MODE debe ser DISABLED, SANDBOX o PRODUCTION",
    });
  }

  parseIntegerInRange(env.DB_PORT, 1, 65535, "DB_PORT", issues);
  parseIntegerInRange(env.DWH_PORT, 1, 65535, "DWH_PORT", issues);
  for (const name of [
    "DWH_LOAD_WINDOW_DAYS",
    "DWH_MAX_FRESHNESS_DAYS",
    "DWH_SMALL_CELL_MIN",
  ] as const) {
    parsePositiveInteger(env[name], name, issues);
  }
  parseIntegerInRange(
    env.RECORDING_RETENTION_YEARS,
    1,
    100,
    "RECORDING_RETENTION_YEARS",
    issues,
  );
  parseIntegerInRange(
    env.RETENTION_CLEANUP_BATCH_SIZE,
    1,
    1000,
    "RETENTION_CLEANUP_BATCH_SIZE",
    issues,
  );
  parseIntegerInRange(
    env.TURN_CREDENTIAL_TTL_SECONDS,
    60,
    86_400,
    "TURN_CREDENTIAL_TTL_SECONDS",
    issues,
  );
  parseIntegerInRange(
    env.AI_TELEMETRY_MAX_EVENT_BYTES,
    256,
    65_536,
    "AI_TELEMETRY_MAX_EVENT_BYTES",
    issues,
  );
  for (const name of [
    "AI_TELEMETRY_RETENTION_RAW_DAYS",
    "AI_TELEMETRY_RETENTION_AGG_DAYS",
    "AI_TELEMETRY_RETENTION_ALERT_DAYS",
  ] as const) {
    parseIntegerInRange(env[name], 1, 36_500, name, issues);
  }
  parseIntegerInRange(
    env.AI_TELEMETRY_ALERT_SCHEMA_FAILURE_SPIKE,
    1,
    1_000_000,
    "AI_TELEMETRY_ALERT_SCHEMA_FAILURE_SPIKE",
    issues,
  );
  parseNumberInRange(
    env.AI_TELEMETRY_ALERT_CITATION_VALIDITY_MIN,
    0,
    1,
    "AI_TELEMETRY_ALERT_CITATION_VALIDITY_MIN",
    issues,
  );
  parseIntegerInRange(
    env.AI_TELEMETRY_ALERT_CRITICAL_DISAGREEMENT,
    1,
    1_000_000,
    "AI_TELEMETRY_ALERT_CRITICAL_DISAGREEMENT",
    issues,
  );
  for (const name of [
    "BACKGROUND_JOBS_ENABLED",
    "DB_ENCRYPT",
    "DB_TRUST_CERT",
    "DB_TRUSTED",
    "DWH_ENABLED",
    "DWH_SCHEDULED_LOAD_ENABLED",
    "DWH_ENCRYPT",
    "DWH_TRUST_CERT",
    "DWH_TRUSTED",
    "RETENTION_CLEANUP_ENABLED",
    "RETENTION_CLEANUP_DRY_RUN",
    "RETENTION_LEGAL_HOLD_REVIEW_ATTESTED",
    "AI_EXPERT_ENABLED",
    "AI_SHADOW_MODE_ENABLED",
    "AI_QUALIFICATION_ENFORCED",
    "AI_TELEMETRY_ALERT_BREAKER_OPENED",
    "AI_TELEMETRY_ALERT_DWH_RECONCILIATION",
    "AI_TELEMETRY_ALERT_UNSAFE_EVENT",
    "AI_TELEMETRY_ALERT_UNAUTHORIZED_RETRIEVAL",
  ] as const) {
    if (env[name] !== undefined && parseBoolean(env[name], false) === null) {
      issues.push({
        group: "config",
        severity: "error",
        message: `${name} debe ser true/false, recibido '${env[name]}'`,
      });
    }
  }
  const dwhStore = env.DWH_STORE?.trim() || "memory";
  if (dwhStore !== "memory" && dwhStore !== "sql") {
    issues.push({
      group: "dwh",
      severity: "error",
      message: "DWH_STORE debe ser memory o sql",
    });
  }
  if (env.RETENTION_CRON_TIMEZONE?.trim()) {
    try {
      new Intl.DateTimeFormat("en", {
        timeZone: env.RETENTION_CRON_TIMEZONE.trim(),
      });
    } catch {
      issues.push({
        group: "config",
        severity: "error",
        message: `RETENTION_CRON_TIMEZONE invalido: '${env.RETENTION_CRON_TIMEZONE}'`,
      });
    }
  }

  if (environmentClass === "STAGING" || environmentClass === "PRODUCTION") {
    if (
      !env.DESKTOP_RELEASE_VERSION?.trim() ||
      env.DESKTOP_RELEASE_VERSION.trim() !== env.RELEASE_VERSION?.trim()
    ) {
      issues.push({
        group: "environment",
        severity: "error",
        message:
          "DESKTOP_RELEASE_VERSION debe coincidir con RELEASE_VERSION en STAGING/PRODUCTION",
      });
    }
    if (env.NODE_ENV !== "production") {
      issues.push({
        group: "environment",
        severity: "error",
        message: "STAGING/PRODUCTION requieren NODE_ENV=production",
      });
    }
    const oltp = (env.DB_NAME ?? "").trim().toLowerCase();
    const dwh = (env.DWH_DATABASE ?? "").trim().toLowerCase();
    if (!oltp || !dwh) {
      issues.push({
        group: "environment",
        severity: "error",
        message:
          "STAGING/PRODUCTION requieren DB_NAME y DWH_DATABASE explícitos",
      });
    } else {
      if (oltp === DEFAULT_OLTP_DB || dwh === DEFAULT_DWH_DB) {
        issues.push({
          group: "environment",
          severity: "error",
          message: `STAGING/PRODUCTION no pueden apuntar a las bases por defecto locales ('${oltp}'/'${dwh}')`,
        });
      }
      if (oltp === dwh) {
        issues.push({
          group: "environment",
          severity: "error",
          message: `OLTP y DWH no pueden ser la misma base ('${oltp}')`,
        });
      }
    }
    if (role === "api") {
      const origins = (env.CORS_ORIGIN ?? "")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      if (origins.length === 0) {
        issues.push({
          group: "config",
          severity: "error",
          message: "CORS_ORIGIN explicito es obligatorio en STAGING/PRODUCTION",
        });
      } else if (origins.some((o) => o === "*" || o.includes("*"))) {
        issues.push({
          group: "config",
          severity: "error",
          message:
            "CORS_ORIGIN con comodín (*) prohibido en STAGING/PRODUCTION",
        });
      } else {
        for (const origin of origins) {
          if (origin === "tauri://localhost") continue;
          try {
            const parsed = new URL(origin);
            if (
              parsed.protocol !== "https:" ||
              parsed.origin !== origin.replace(/\/$/, "") ||
              unsafeRemoteHostname(parsed.hostname) ||
              parsed.username ||
              parsed.password
            ) {
              throw new Error("invalid origin");
            }
          } catch {
            issues.push({
              group: "config",
              severity: "error",
              message: `CORS_ORIGIN no aprobado para despliegue: '${origin}'`,
            });
          }
        }
      }

      requireHttpsUrl(env.PUBLIC_API_URL, "PUBLIC_API_URL", issues);
      requireHttpsUrl(env.PUBLIC_WEB_URL, "PUBLIC_WEB_URL", issues);
      requireRuntimeSecret(env.JWT_SECRET, 32, "JWT_SECRET", issues);
      requireRuntimeSecret(
        env.FIELD_ENCRYPTION_KEY,
        32,
        "FIELD_ENCRYPTION_KEY",
        issues,
      );
    }

    const requiredNames =
      role === "api"
        ? ([
            "API_BIND_HOST",
            "TRUST_PROXY",
            "BACKGROUND_JOBS_ENABLED",
            "DB_SERVER",
            "ENVIRONMENT_NAME",
            "INSTANCE_ID",
            "DEPLOYMENT_ID",
            "RELEASE_VERSION",
            "GIT_COMMIT",
            "WORKLOAD_ROLE",
          ] as const)
        : ([
            "BACKGROUND_JOBS_ENABLED",
            "DB_SERVER",
            "ENVIRONMENT_NAME",
            "INSTANCE_ID",
            "DEPLOYMENT_ID",
            "RELEASE_VERSION",
            "GIT_COMMIT",
            "WORKLOAD_ROLE",
          ] as const);
    for (const name of requiredNames) {
      if (!env[name]?.trim()) {
        issues.push({
          group: "environment",
          severity: "error",
          message: `${name} explicito es obligatorio en STAGING/PRODUCTION`,
        });
      }
    }
    for (const name of [
      "ENVIRONMENT_NAME",
      "INSTANCE_ID",
      "DEPLOYMENT_ID",
    ] as const) {
      if (
        env[name]?.trim() &&
        !/^[A-Za-z0-9_.:-]{1,160}$/.test(env[name]!.trim())
      ) {
        issues.push({
          group: "environment",
          severity: "error",
          message: `${name} contiene caracteres no permitidos`,
        });
      }
    }
    for (const name of ["DB_NAME", "DWH_DATABASE"] as const) {
      if (
        env[name]?.trim() &&
        !/^[A-Za-z0-9_.-]{1,128}$/.test(env[name]!.trim())
      ) {
        issues.push({
          group: "environment",
          severity: "error",
          message: `${name} contiene caracteres no permitidos`,
        });
      }
    }
    for (const name of ["API_ARTIFACT", "WEB_ARTIFACT"] as const) {
      if (!env[name]?.trim() || /(?:^|:)latest$/i.test(env[name]!.trim())) {
        issues.push({
          group: "artifact",
          severity: "error",
          message: `${name} inmutable es obligatorio en STAGING/PRODUCTION`,
        });
      }
    }
    for (const name of [
      "API_ARTIFACT_DIGEST",
      "WEB_ARTIFACT_DIGEST",
    ] as const) {
      if (!/^sha256:[0-9a-f]{64}$/i.test(env[name]?.trim() ?? "")) {
        issues.push({
          group: "artifact",
          severity: "error",
          message: `${name} debe ser digest sha256 inmutable`,
        });
      }
    }
    for (const prefix of ["API", "WEB"] as const) {
      const artifact = env[`${prefix}_ARTIFACT`]?.trim() ?? "";
      const digest = env[`${prefix}_ARTIFACT_DIGEST`]?.trim() ?? "";
      if (!validDigestBoundArtifact(artifact, digest)) {
        issues.push({
          group: "artifact",
          severity: "error",
          message: `${prefix}_ARTIFACT debe estar ligado a ${prefix}_ARTIFACT_DIGEST`,
        });
      }
    }
    if (env.GIT_COMMIT && !/^[0-9a-f]{40}$/i.test(env.GIT_COMMIT.trim())) {
      issues.push({
        group: "environment",
        severity: "error",
        message: "GIT_COMMIT debe ser SHA-1 completo de 40 hex",
      });
    }
    if (
      env.SECRET_SCAN_STATUS !== "PASS" ||
      env.SECRET_SCAN_COMMIT?.trim() !== env.GIT_COMMIT?.trim() ||
      !isSafeEvidenceReference(env.SECRET_SCAN_EVIDENCE_ID)
    ) {
      issues.push({
        group: "security",
        severity: "error",
        message:
          "scan de secretos atestado y ligado a GIT_COMMIT es obligatorio",
      });
    }
    if (env.RELEASE_VERSION && !isReleaseVersion(env.RELEASE_VERSION)) {
      issues.push({
        group: "environment",
        severity: "error",
        message: "RELEASE_VERSION debe ser semver explícito",
      });
    }
    if (role === "api" && env.TRUST_PROXY === "false") {
      issues.push({
        group: "network",
        severity: "error",
        message: "TRUST_PROXY=false no es valido detras del edge requerido",
      });
    }
    if (role === "api" && env.BACKGROUND_JOBS_ENABLED !== "false") {
      issues.push({
        group: "workload",
        severity: "error",
        message:
          "API requiere BACKGROUND_JOBS_ENABLED=false; usar el runner jobs dedicado",
      });
    }
    if (role === "jobs" && env.BACKGROUND_JOBS_ENABLED !== "true") {
      issues.push({
        group: "workload",
        severity: "error",
        message: "runner jobs requiere BACKGROUND_JOBS_ENABLED=true",
      });
    }
    if (
      role === "jobs" &&
      env.RETENTION_CLEANUP_ENABLED === "true" &&
      env.RETENTION_CLEANUP_DRY_RUN === "false" &&
      env.RETENTION_LEGAL_HOLD_REVIEW_ATTESTED !== "true"
    ) {
      issues.push({
        group: "retention",
        severity: "error",
        message:
          "cleanup destructivo requiere RETENTION_LEGAL_HOLD_REVIEW_ATTESTED=true",
      });
    }
    if (env.DB_ENCRYPT !== "true" || env.DB_TRUST_CERT !== "false") {
      issues.push({
        group: "database",
        severity: "error",
        message:
          "STAGING/PRODUCTION requieren DB_ENCRYPT=true y DB_TRUST_CERT=false",
      });
    }
    const dwhEncrypt = configured(env.DWH_ENCRYPT, env.DB_ENCRYPT);
    const dwhTrustCert = configured(env.DWH_TRUST_CERT, env.DB_TRUST_CERT);
    if (dwhEncrypt !== "true" || dwhTrustCert !== "false") {
      issues.push({
        group: "dwh",
        severity: "error",
        message:
          "STAGING/PRODUCTION requieren TLS DWH con validacion de certificado",
      });
    }
    if (!env.EXTERNAL_SIDE_EFFECTS_MODE?.trim()) {
      issues.push({
        group: "external",
        severity: "error",
        message:
          "EXTERNAL_SIDE_EFFECTS_MODE explicito es obligatorio en STAGING/PRODUCTION",
      });
    }
    if (
      environmentClass === "STAGING" &&
      externalSideEffects === "PRODUCTION"
    ) {
      issues.push({
        group: "external",
        severity: "error",
        message: "STAGING no puede usar efectos externos en modo PRODUCTION",
      });
    }
    if (env.TURN_URLS?.trim() && externalSideEffects !== "DISABLED") {
      if (!validIceUrls(env.TURN_URLS, "turn")) {
        issues.push({
          group: "external",
          severity: "error",
          message: "TURN_URLS solo acepta URLs turn:/turns:",
        });
      }
      if (environmentClass === "PRODUCTION") {
        requireRuntimeSecret(
          env.TURN_SHARED_SECRET,
          32,
          "TURN_SHARED_SECRET",
          issues,
        );
      } else {
        const ephemeral = Boolean(env.TURN_SHARED_SECRET?.trim());
        const staticSandbox =
          Boolean(env.TURN_USERNAME?.trim()) &&
          Boolean(env.TURN_CREDENTIAL?.trim());
        if (!ephemeral && !staticSandbox) {
          issues.push({
            group: "external",
            severity: "error",
            message:
              "TURN sandbox requiere credenciales completas o TURN_SHARED_SECRET",
          });
        }
      }
    }
    if (
      env.STUN_URLS?.trim() &&
      externalSideEffects !== "DISABLED" &&
      !validIceUrls(env.STUN_URLS, "stun")
    ) {
      issues.push({
        group: "external",
        severity: "error",
        message: "STUN_URLS solo acepta URLs stun:/stuns:",
      });
    }
    if ((env.AI_PATIENT_ENABLED ?? "false") === "true") {
      issues.push({
        group: "ai",
        severity: "error",
        message:
          "AI_PATIENT_ENABLED debe permanecer false en STAGING/PRODUCTION",
      });
    }
    if ((env.AI_EGRESS_ENABLED ?? "false") !== "false") {
      issues.push({
        group: "ai",
        severity: "error",
        message:
          "AI_EGRESS_ENABLED debe permanecer false hasta autorizar un modelo elegible",
      });
    }
    if ((env.AI_SHADOW_STATE ?? "DISABLED") !== "DISABLED") {
      issues.push({
        group: "shadow",
        severity: "error",
        message:
          "AI_SHADOW_STATE debe permanecer DISABLED mientras staging/modelo estan bloqueados",
      });
    }
    if (env.DB_TRUSTED !== "true") {
      requireRuntimeSecret(env.DB_PASSWORD, 12, "DB_PASSWORD", issues);
    }
    const dwhEnabledForWorkload =
      env.DWH_ENABLED === "true" && env.DWH_STORE === "sql";
    if (env.DWH_ENABLED === "true" && env.DWH_STORE !== "sql") {
      issues.push({
        group: "dwh",
        severity: "error",
        message:
          "STAGING/PRODUCTION con DWH_ENABLED=true requieren DWH_STORE=sql",
      });
    }
    const dwhTrusted = configured(env.DWH_TRUSTED, env.DB_TRUSTED) === "true";
    if (dwhEnabledForWorkload && !dwhTrusted) {
      requireRuntimeSecret(
        configured(env.DWH_PASSWORD, env.DB_PASSWORD),
        12,
        "DWH_PASSWORD/DB_PASSWORD",
        issues,
      );
    }
  }

  if (environmentClass === "PRODUCTION") {
    const trusted = env.DB_TRUSTED === "true";
    const usesDefaultPassword =
      !trusted && (env.DB_PASSWORD === undefined || env.DB_PASSWORD === "");
    if (usesDefaultPassword) {
      issues.push({
        group: "database",
        severity: "error",
        message: "PRODUCTION no puede usar contraseña vacía por defecto",
      });
    }
    if (externalSideEffects === "PRODUCTION") {
      parseIntegerInRange(env.SMTP_PORT, 1, 65535, "SMTP_PORT", issues);
      for (const name of [
        "SMTP_HOST",
        "SMTP_USER",
        "SMTP_PASS",
        "EMAIL_FROM",
      ] as const) {
        if (!env[name]?.trim()) {
          issues.push({
            group: "external",
            severity: "error",
            message: `${name} es obligatorio para email en modo PRODUCTION`,
          });
        }
      }
      requireRuntimeSecret(env.SMTP_PASS, 12, "SMTP_PASS", issues);
    }
  }

  const dwhEnabled = (env.DWH_ENABLED ?? "false") === "true";
  if (dwhEnabled) {
    try {
      assertDwhDatabaseSeparate(env);
    } catch (err) {
      issues.push({
        group: "dwh",
        severity: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const egress = parseBoolean(env.AI_EGRESS_ENABLED, false);
  if (egress === null) {
    issues.push({
      group: "ai",
      severity: "error",
      message: `AI_EGRESS_ENABLED debe ser true/false, recibido '${env.AI_EGRESS_ENABLED}'`,
    });
  }
  const patientAi = parseBoolean(env.AI_PATIENT_ENABLED, false);
  if (patientAi === null) {
    issues.push({
      group: "ai",
      severity: "error",
      message: `AI_PATIENT_ENABLED debe ser true/false, recibido '${env.AI_PATIENT_ENABLED}'`,
    });
  }
  if (patientAi === true) {
    issues.push({
      group: "ai",
      severity: "warning",
      message:
        "AI_PATIENT_ENABLED=true: el gate clínico sigue bloqueado hasta release gate",
    });
  }

  const shadowState = (env.AI_SHADOW_STATE ?? "DISABLED").trim();
  if (!SHADOW_STATES.includes(shadowState as never)) {
    issues.push({
      group: "shadow",
      severity: "error",
      message: `AI_SHADOW_STATE inválido: '${shadowState}'`,
    });
  }
  const aiProvider = env.AI_PROVIDER?.trim();
  if (aiProvider && aiProvider !== "openai" && aiProvider !== "ollama") {
    issues.push({
      group: "ai",
      severity: "error",
      message: `AI_PROVIDER inválido: '${aiProvider}'`,
    });
  }
  parseNumberInRange(
    env.AI_SHADOW_SAMPLE_RATE,
    0,
    1,
    "AI_SHADOW_SAMPLE_RATE",
    issues,
  );
  parsePositiveInteger(
    env.AI_CLINICAL_DISAGREEMENT_THRESHOLD,
    "AI_CLINICAL_DISAGREEMENT_THRESHOLD",
    issues,
  );
  parsePositiveInteger(
    env.AI_CLINICAL_WINDOW_DAYS,
    "AI_CLINICAL_WINDOW_DAYS",
    issues,
  );
  parseNumberInRange(
    env.AI_TELEMETRY_PERCENTILE_MIN_SAMPLES,
    1,
    100000,
    "AI_TELEMETRY_PERCENTILE_MIN_SAMPLES",
    issues,
  );

  const telemetryStore = (env.AI_TELEMETRY_STORE ?? "memory").trim();
  if (telemetryStore !== "memory" && telemetryStore !== "sql") {
    issues.push({
      group: "observability",
      severity: "error",
      message: `AI_TELEMETRY_STORE inválido: '${telemetryStore}'`,
    });
  }

  const certificationStore = (env.AI_CERTIFICATION_STORE ?? "memory").trim();
  if (certificationStore !== "memory" && certificationStore !== "sql") {
    issues.push({
      group: "certification",
      severity: "error",
      message: `AI_CERTIFICATION_STORE inválido: '${certificationStore}'`,
    });
  }

  const clinicalReviewStore = (env.AI_CLINICAL_REVIEW_STORE ?? "memory").trim();
  if (clinicalReviewStore !== "memory" && clinicalReviewStore !== "sql") {
    issues.push({
      group: "clinical-gate",
      severity: "error",
      message: `AI_CLINICAL_REVIEW_STORE inválido: '${clinicalReviewStore}'`,
    });
  }
  if (environmentClass === "STAGING" || environmentClass === "PRODUCTION") {
    if (telemetryStore !== "sql") {
      issues.push({
        group: "observability",
        severity: "error",
        message: "STAGING/PRODUCTION requieren AI_TELEMETRY_STORE=sql",
      });
    }
    if (certificationStore !== "sql") {
      issues.push({
        group: "certification",
        severity: "error",
        message: "STAGING/PRODUCTION requieren AI_CERTIFICATION_STORE=sql",
      });
    }
    if (clinicalReviewStore !== "sql") {
      issues.push({
        group: "clinical-gate",
        severity: "error",
        message: "STAGING/PRODUCTION requieren AI_CLINICAL_REVIEW_STORE=sql",
      });
    }
    if ((env.AI_QUALIFICATION_ENFORCED ?? "true") !== "true") {
      issues.push({
        group: "ai",
        severity: "error",
        message:
          "AI_QUALIFICATION_ENFORCED debe permanecer true en STAGING/PRODUCTION",
      });
    }
    if ((env.AI_SHADOW_MODE_ENABLED ?? "false") !== "false") {
      issues.push({
        group: "shadow",
        severity: "error",
        message:
          "AI_SHADOW_MODE_ENABLED debe permanecer false mientras staging/modelo estan bloqueados",
      });
    }
  }

  if (deps.ai) {
    for (const issue of deps.ai.validate(env)) {
      issues.push({
        group: "ai",
        severity: issue.severity,
        message: issue.message,
      });
    }
  }

  return issues;
}

export function assertStartupConfigValid(
  env: NodeJS.ProcessEnv = process.env,
  deps: StartupValidationDeps = {},
): void {
  const issues = validateStartupConfig(env, deps);
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `configuración de arranque inválida (fail-fast):\n${errors.map((e) => `- [${e.group}] ${e.message}`).join("\n")}`,
    );
  }
  for (const warning of issues.filter(
    (issue) => issue.severity === "warning",
  )) {
    console.warn(`[startup-config] ${warning.message}`);
  }
}

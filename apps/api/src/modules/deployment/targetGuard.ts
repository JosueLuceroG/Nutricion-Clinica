import {
  isReleaseVersion,
  readEnvironmentClass,
  type EnvironmentClass,
} from "./environmentIdentity.js";
import { isSafeEvidenceReference } from "./deploymentEvidence.js";

/**
 * Guardas de objetivo (Build 09.5A §6, §26-28, §48).
 * Acciones destructivas/sensibles contra PRODUCTION o entornos UNKNOWN => fail-closed
 * salvo ALLOW_PRODUCTION_<ACCION>=true explicito.
 * STAGING debe apuntar a bases operacionalmente distintas (nunca los nombres locales
 * por defecto 'nutriclinica' / 'nutriclinicadw').
 */

export type DestructiveAction =
  | "migrate"
  | "dwh_schema"
  | "seed"
  | "reset"
  | "rebuild"
  | "drop"
  | "maintenance";

export const DEFAULT_OLTP_DB = "nutriclinica";
export const DEFAULT_DWH_DB = "nutriclinicadw";

export class TargetGuardError extends Error {
  constructor(message: string) {
    super(`guard: ${message}`);
    this.name = "TargetGuardError";
  }
}

function blockTarget(message: string): never {
  throw new TargetGuardError(message);
}

export function assertTargetSafe(
  action: DestructiveAction,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const environmentClass = readEnvironmentClass(env);
  if (environmentClass === "UNKNOWN") {
    blockTarget(`entorno UNKNOWN: '${action}' bloqueado (fail-closed)`);
  }
  if (environmentClass === "PRODUCTION") {
    const allowed = env[`ALLOW_PRODUCTION_${action.toUpperCase()}`] === "true";
    if (!allowed) {
      blockTarget(
        `'${action}' bloqueado contra PRODUCTION; requiere ALLOW_PRODUCTION_${action.toUpperCase()}=true explicito`,
      );
    }
  }
  if (environmentClass === "STAGING" || environmentClass === "PRODUCTION") {
    assertStagingDatabases(env);
    if (
      environmentClass === "STAGING" &&
      (action === "seed" ||
        action === "reset" ||
        action === "rebuild" ||
        action === "drop") &&
      env[`ALLOW_STAGING_${action.toUpperCase()}`] !== "true"
    ) {
      blockTarget(
        `'${action}' bloqueado contra STAGING; requiere ALLOW_STAGING_${action.toUpperCase()}=true explicito`,
      );
    }
    assertOneShotPreflight(action, env);
  }
}

function requireValue(condition: boolean, message: string): void {
  if (!condition) blockTarget(message);
}

function assertOneShotPreflight(
  action: DestructiveAction,
  env: NodeJS.ProcessEnv,
): void {
  const expectedRole = action === "dwh_schema" ? "dwh-schema" : "migration";
  requireValue(
    env.NODE_ENV === "production",
    "one-shot SQL requiere NODE_ENV=production",
  );
  requireValue(
    env.WORKLOAD_ROLE === expectedRole,
    `one-shot SQL requiere WORKLOAD_ROLE=${expectedRole}`,
  );
  requireValue(
    Boolean(env.DEPLOYMENT_ID?.trim()),
    "DEPLOYMENT_ID explicito es obligatorio",
  );
  requireValue(
    isReleaseVersion(env.RELEASE_VERSION),
    "RELEASE_VERSION semver es obligatorio",
  );
  requireValue(
    /^[0-9a-f]{40}$/i.test(env.GIT_COMMIT?.trim() ?? ""),
    "GIT_COMMIT completo es obligatorio",
  );
  const artifactDigest = env.API_ARTIFACT_DIGEST?.trim() ?? "";
  requireValue(
    /^sha256:[0-9a-f]{64}$/i.test(artifactDigest),
    "API_ARTIFACT_DIGEST sha256 es obligatorio",
  );
  const artifactId = env.API_ARTIFACT?.trim() ?? "";
  const artifactSuffix = `@${artifactDigest}`;
  requireValue(
    artifactId.endsWith(artifactSuffix) &&
      /^[A-Za-z0-9][A-Za-z0-9._/:+-]{0,299}$/.test(
        artifactId.slice(0, -artifactSuffix.length),
      ),
    "API_ARTIFACT debe estar ligado a su digest",
  );
  requireValue(
    env.SECRET_SCAN_STATUS === "PASS" &&
      env.SECRET_SCAN_COMMIT?.trim() === env.GIT_COMMIT?.trim() &&
      isSafeEvidenceReference(env.SECRET_SCAN_EVIDENCE_ID),
    "scan de secretos atestado para GIT_COMMIT es obligatorio",
  );
  requireValue(
    Boolean(env.CHANGE_REQUEST_ID?.trim()) &&
      !/change|replace|example|todo/i.test(env.CHANGE_REQUEST_ID ?? ""),
    "CHANGE_REQUEST_ID aprobado es obligatorio",
  );
  requireValue(
    env.BACKUP_RESTORE_ATTESTED === "true",
    "BACKUP_RESTORE_ATTESTED=true es obligatorio",
  );
  requireValue(
    /^sha256:[0-9a-f]{64}$/i.test(env.ROLLBACK_ARTIFACT_DIGEST?.trim() ?? ""),
    "ROLLBACK_ARTIFACT_DIGEST sha256 es obligatorio",
  );

  if (action !== "dwh_schema") {
    requireValue(
      Boolean(env.DB_SERVER?.trim()),
      "DB_SERVER explicito es obligatorio",
    );
    requireValue(
      env.DB_ENCRYPT === "true" && env.DB_TRUST_CERT === "false",
      "migracion OLTP requiere DB_ENCRYPT=true y DB_TRUST_CERT=false",
    );
    if (env.DB_TRUSTED !== "true") {
      requireValue(
        (env.DB_PASSWORD?.trim().length ?? 0) >= 12,
        "DB_PASSWORD inyectada es obligatoria para SQL Auth",
      );
    }
  } else {
    requireValue(
      Boolean(env.DWH_SERVER?.trim() || env.DB_SERVER?.trim()),
      "DWH_SERVER/DB_SERVER explicito es obligatorio",
    );
    const encrypt = env.DWH_ENCRYPT?.trim() || env.DB_ENCRYPT?.trim();
    const trustCert = env.DWH_TRUST_CERT?.trim() || env.DB_TRUST_CERT?.trim();
    requireValue(
      encrypt === "true" && trustCert === "false",
      "schema DWH requiere TLS con certificado validado",
    );
    const trusted =
      (env.DWH_TRUSTED?.trim() || env.DB_TRUSTED?.trim()) === "true";
    if (!trusted) {
      const password = env.DWH_PASSWORD?.trim() || env.DB_PASSWORD?.trim();
      requireValue(
        (password?.length ?? 0) >= 12,
        "DWH_PASSWORD/DB_PASSWORD inyectada es obligatoria para SQL Auth",
      );
    }
  }
}

/** Los objetivos remotos no pueden usar bases locales por defecto ni mezclar OLTP/DWH. */
export function assertStagingDatabases(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const oltp = (env.DB_NAME ?? "").trim().toLowerCase();
  const dwh = (env.DWH_DATABASE ?? "").trim().toLowerCase();
  if (!oltp || !dwh) {
    blockTarget("objetivo remoto requiere DB_NAME y DWH_DATABASE explicitos");
  }
  if (oltp === dwh) {
    blockTarget(
      `objetivo remoto no puede usar la misma base para OLTP y DWH ('${oltp}')`,
    );
  }
  if (oltp === DEFAULT_OLTP_DB || dwh === DEFAULT_DWH_DB) {
    blockTarget(
      `objetivo remoto no puede apuntar a las bases por defecto locales ('${oltp}'/'${dwh}')`,
    );
  }
}

export function describeTarget(env: NodeJS.ProcessEnv = process.env): {
  environmentClass: EnvironmentClass;
  oltp: string;
  dwh: string;
} {
  const environmentClass = readEnvironmentClass(env);
  const oltp = (env.DB_NAME ?? DEFAULT_OLTP_DB).trim();
  const dwh = (env.DWH_DATABASE ?? DEFAULT_DWH_DB).trim();
  return { environmentClass, oltp, dwh };
}

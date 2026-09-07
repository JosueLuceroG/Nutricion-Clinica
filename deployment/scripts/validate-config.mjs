import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { isReleaseVersion } from "./release-version.mjs";

const ENVIRONMENTS = new Set(["TEST", "STAGING", "PRODUCTION"]);
const REQUIRED = [
  "DEPLOYMENT_ENVIRONMENT",
  "RELEASE_VERSION",
  "RELEASE_COMMIT",
  "API_ARTIFACT",
  "API_ARTIFACT_DIGEST",
  "WEB_ARTIFACT",
  "WEB_ARTIFACT_DIGEST",
  "API_HOST",
  "WEB_HOST",
  "OLTP_TARGET",
  "DWH_TARGET",
  "SECRET_PROVIDER",
  "STORAGE_TARGET",
  "BACKUP_TARGET",
  "SECRET_SCAN_STATUS",
  "SECRET_SCAN_COMMIT",
  "SECRET_SCAN_EVIDENCE_ID",
];
const ALLOWED_INPUTS = new Set(REQUIRED);

function unsafeRemoteHostname(hostname) {
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

function remoteHttps(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !unsafeRemoteHostname(url.hostname) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function validateDeploymentInputs(input) {
  const errors = [];
  for (const name of REQUIRED) {
    if (!String(input[name] ?? "").trim()) errors.push(`${name} is required`);
  }

  const environment = String(input.DEPLOYMENT_ENVIRONMENT ?? "").trim();
  if (!ENVIRONMENTS.has(environment)) {
    errors.push("DEPLOYMENT_ENVIRONMENT must be TEST, STAGING, or PRODUCTION");
  }

  if (!/^[0-9a-f]{40}$/i.test(String(input.RELEASE_COMMIT ?? ""))) {
    errors.push("RELEASE_COMMIT must be a full 40-character Git SHA");
  }
  if (!isReleaseVersion(String(input.RELEASE_VERSION ?? ""))) {
    errors.push("RELEASE_VERSION must be an explicit semantic version");
  }

  for (const name of ["API_ARTIFACT", "WEB_ARTIFACT"]) {
    const artifact = String(input[name] ?? "");
    if (/(?:^|:)latest$/i.test(artifact)) {
      errors.push(`${name} cannot use latest`);
    }
  }
  for (const name of ["API_ARTIFACT_DIGEST", "WEB_ARTIFACT_DIGEST"]) {
    if (!/^sha256:[0-9a-f]{64}$/i.test(String(input[name] ?? ""))) {
      errors.push(`${name} must be an immutable sha256 digest`);
    }
  }
  for (const prefix of ["API", "WEB"]) {
    const artifact = String(input[`${prefix}_ARTIFACT`] ?? "");
    const digest = String(input[`${prefix}_ARTIFACT_DIGEST`] ?? "");
    const suffix = `@${digest}`;
    const repository = artifact.endsWith(suffix)
      ? artifact.slice(0, -suffix.length)
      : "";
    if (!/^[A-Za-z0-9][A-Za-z0-9._/:+-]{0,299}$/.test(repository)) {
      errors.push(`${prefix}_ARTIFACT must be bound to its sha256 digest`);
    }
  }

  if (input.SECRET_SCAN_STATUS !== "PASS") {
    errors.push("SECRET_SCAN_STATUS must be PASS");
  }
  if (
    String(input.SECRET_SCAN_COMMIT ?? "").trim() !==
    String(input.RELEASE_COMMIT ?? "").trim()
  ) {
    errors.push("SECRET_SCAN_COMMIT must match RELEASE_COMMIT");
  }
  const evidenceId = String(input.SECRET_SCAN_EVIDENCE_ID ?? "");
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:/+-]{5,199}$/.test(evidenceId) ||
    /(?:^sk-|change|replace|example|placeholder|todo)/i.test(evidenceId) ||
    evidenceId === "PHI_DEPLOYMENT_MARKER_6f6db2"
  ) {
    errors.push(
      "SECRET_SCAN_EVIDENCE_ID must be an explicit non-secret evidence reference",
    );
  }

  if (
    String(input.OLTP_TARGET ?? "")
      .trim()
      .toLowerCase() ===
    String(input.DWH_TARGET ?? "")
      .trim()
      .toLowerCase()
  ) {
    errors.push("OLTP_TARGET and DWH_TARGET must be different");
  }

  for (const name of ["OLTP_TARGET", "DWH_TARGET"]) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(String(input[name] ?? ""))) {
      errors.push(`${name} must be an explicit database identity`);
    }
  }
  for (const name of ["SECRET_PROVIDER", "STORAGE_TARGET", "BACKUP_TARGET"]) {
    const value = String(input[name] ?? "");
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._:/+-]{2,199}$/.test(value) ||
      /(?:change|replace|example|placeholder|todo)/i.test(value)
    ) {
      errors.push(`${name} must be an explicit operator-approved identity`);
    }
  }

  if (environment === "STAGING" || environment === "PRODUCTION") {
    if (!remoteHttps(String(input.API_HOST ?? ""))) {
      errors.push("API_HOST must be a remote HTTPS URL");
    }
    if (!remoteHttps(String(input.WEB_HOST ?? ""))) {
      errors.push("WEB_HOST must be a remote HTTPS URL");
    }
    if (
      String(input.OLTP_TARGET ?? "").toLowerCase() === "nutriclinica" ||
      String(input.DWH_TARGET ?? "").toLowerCase() === "nutriclinicadw"
    ) {
      errors.push(
        "remote targets cannot use local default database identities",
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

export function parseDeploymentInputs(content) {
  const input = {};
  for (const [index, raw] of content.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match)
      throw new Error(`invalid deployment input at line ${index + 1}`);
    if (!ALLOWED_INPUTS.has(match[1]))
      throw new Error(
        `unknown deployment input ${match[1]} at line ${index + 1}`,
      );
    if (Object.hasOwn(input, match[1]))
      throw new Error(`duplicate deployment input ${match[1]}`);
    input[match[1]] = match[2].trim().replace(/^(?:"(.*)"|'(.*)')$/, "$1$2");
  }
  return input;
}

export function buildRuntimeMapping(input) {
  return {
    ENVIRONMENT_CLASS: input.DEPLOYMENT_ENVIRONMENT,
    RELEASE_VERSION: input.RELEASE_VERSION,
    DESKTOP_RELEASE_VERSION: input.RELEASE_VERSION,
    GIT_COMMIT: input.RELEASE_COMMIT,
    PUBLIC_API_URL: input.API_HOST,
    PUBLIC_WEB_URL: input.WEB_HOST,
    DB_NAME: input.OLTP_TARGET,
    DWH_DATABASE: input.DWH_TARGET,
    API_ARTIFACT: input.API_ARTIFACT,
    API_ARTIFACT_DIGEST: input.API_ARTIFACT_DIGEST,
    WEB_ARTIFACT: input.WEB_ARTIFACT,
    WEB_ARTIFACT_DIGEST: input.WEB_ARTIFACT_DIGEST,
    SECRET_SCAN_EVIDENCE_ID: input.SECRET_SCAN_EVIDENCE_ID,
    SECRET_SCAN_STATUS: input.SECRET_SCAN_STATUS,
    SECRET_SCAN_COMMIT: input.SECRET_SCAN_COMMIT,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const envFileIndex = process.argv.indexOf("--env-file");
  const envFile =
    envFileIndex >= 0 ? process.argv[envFileIndex + 1] : undefined;
  if (envFileIndex >= 0 && !envFile)
    throw new Error("--env-file requires a path");
  const input = envFile
    ? parseDeploymentInputs(await readFile(envFile, "utf8"))
    : process.env;
  const result = validateDeploymentInputs(input);
  if (!result.valid) {
    for (const error of result.errors)
      console.error(`[deployment-config] ${error}`);
    process.exitCode = 1;
  } else {
    console.log("deployment-config: PASS");
    if (process.argv.includes("--print-runtime-map")) {
      console.log(JSON.stringify(buildRuntimeMapping(input), null, 2));
    }
  }
}

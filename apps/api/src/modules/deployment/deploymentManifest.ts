import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fnv1a32Hex } from "../ai/rag/knowledgeVersioning.js";
import { CURRENT_VERSIONS } from "../ai/certification/versions.js";
import { DWH_SCHEMA_VERSION } from "../dwh/schema/dwhSchema.js";
import {
  API_VERSION,
  DEXIE_SCHEMA_VERSION,
  SYNC_SCHEMA_VERSION,
} from "@nutriclinica/shared";
import {
  buildEnvironmentIdentity,
  isReleaseVersion,
  type EnvironmentIdentity,
} from "./environmentIdentity.js";
import { safeEvidenceReference } from "./deploymentEvidence.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT =
  process.env.NUTRICLINICA_REPO_ROOT?.trim() ||
  join(__dirname, "..", "..", "..", "..", "..");
const MIGRATIONS_DIR = join(REPO_ROOT, "apps", "api", "migrations");
const API_PACKAGE_JSON = join(REPO_ROOT, "apps", "api", "package.json");
const ROOT_PACKAGE_JSON = join(REPO_ROOT, "package.json");
const TAURI_CONFIG_JSON = join(REPO_ROOT, "src-tauri", "tauri.conf.json");
const CARGO_LOCK = join(REPO_ROOT, "src-tauri", "Cargo.lock");

let cachedOltpSchemaVersion: string | null = null;
let cachedApiVersion: string | null = null;
let cachedFrontendVersion: string | null = null;
let cachedDesktopVersion: string | null = null;
let cachedDesktopTauriVersion: string | null = null;

/** Última migración del directorio de migraciones (repositorio = fuente de verdad). */
export function currentOltpSchemaVersion(): string {
  if (cachedOltpSchemaVersion !== null) return cachedOltpSchemaVersion;
  try {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d{3}-.+\.sql$/.test(f))
      .sort();
    cachedOltpSchemaVersion =
      files.length > 0 ? files[files.length - 1]!.split("-")[0]! : "000";
  } catch {
    cachedOltpSchemaVersion = "UNKNOWN";
  }
  return cachedOltpSchemaVersion;
}

/** Versión de la API desde apps/api/package.json (fuente autoritativa). */
export function currentApiVersion(): string {
  if (cachedApiVersion !== null) return cachedApiVersion;
  try {
    const pkg = JSON.parse(readFileSync(API_PACKAGE_JSON, "utf8")) as {
      version?: string;
    };
    cachedApiVersion = pkg.version ?? "UNKNOWN";
  } catch {
    cachedApiVersion = "UNKNOWN";
  }
  return cachedApiVersion;
}

/** Versión del bundle de prompts (hash determinista de TODAS las versiones de prompt). */
export function currentPromptBundleVersion(): string {
  const sorted = Object.values(CURRENT_VERSIONS.promptVersion).sort();
  return `prompt-bundle.${fnv1a32Hex(sorted.join("|"))}`;
}

/** Hash determinista de todas las versiones de schema de salida. */
export function currentOutputSchemaBundleVersion(): string {
  const sorted = Object.values(CURRENT_VERSIONS.outputSchemaVersion).sort();
  return `output-schema-bundle.${fnv1a32Hex(sorted.join("|"))}`;
}

/** Versión de la app frontend (web = mismo paquete root; desktop = Tauri, ver tauri.conf.json). */
export function currentFrontendVersion(): string {
  if (cachedFrontendVersion !== null) return cachedFrontendVersion;
  try {
    const pkg = JSON.parse(readFileSync(ROOT_PACKAGE_JSON, "utf8")) as {
      version?: string;
    };
    cachedFrontendVersion = pkg.version ?? "UNKNOWN";
  } catch {
    cachedFrontendVersion = "UNKNOWN";
  }
  return cachedFrontendVersion;
}

/** Versión del cliente desktop desde tauri.conf.json (fuente única del bundle). */
export function currentDesktopVersion(): string {
  if (cachedDesktopVersion !== null) return cachedDesktopVersion;
  try {
    const conf = JSON.parse(readFileSync(TAURI_CONFIG_JSON, "utf8")) as {
      version?: string;
    };
    cachedDesktopVersion = conf.version ?? "UNKNOWN";
  } catch {
    cachedDesktopVersion = "UNKNOWN";
  }
  return cachedDesktopVersion;
}

/** Versión exacta de Tauri desde Cargo.lock (dependencia bloqueada del binario desktop). */
export function currentDesktopTauriVersion(): string {
  if (cachedDesktopTauriVersion !== null) return cachedDesktopTauriVersion;
  try {
    const lock = readFileSync(CARGO_LOCK, "utf8");
    const match = /^name = "tauri"\r?\nversion = "([^"]+)"/m.exec(lock);
    cachedDesktopTauriVersion = match?.[1] ?? "UNKNOWN";
  } catch {
    cachedDesktopTauriVersion = "UNKNOWN";
  }
  return cachedDesktopTauriVersion;
}

export interface DeploymentManifest {
  releaseVersion: string;
  gitCommit: string;
  environment: EnvironmentIdentity;
  desktopVersion: string;
  desktopChannel: "primary";
  desktopTauriVersion: string;
  dexieSchemaVersion: number;
  syncProtocolVersion: number;
  webVersion: string;
  webChannel: "secondary";
  apiVersion: string;
  apiContractVersion: string;
  oltpSchemaVersion: string;
  dwhSchemaVersion: string;
  semanticCatalogVersion: string;
  knowledgePolicyVersion: string;
  retrievalPolicyVersion: string;
  memoryPolicyVersion: string;
  aiPolicyVersion: string;
  evaluationDatasetVersion: string;
  toolsetVersion: string;
  promptBundleVersion: string;
  outputSchemaBundleVersion: string;
  frontendVersion: string;
  publicEndpoints: {
    api: string;
    web: string;
  };
  artifacts: {
    desktop: { id: string; digest: string };
    web: { id: string; digest: string };
    api: { id: string; digest: string };
  };
  securityEvidence: {
    secretScanStatus: "PASS" | "UNVERIFIED";
    commit: string;
    evidenceId: string;
  };
  deployedAt: string;
}

function safeArtifactId(value: string | undefined): string {
  const raw = value?.trim();
  return raw &&
    /^[A-Za-z0-9][A-Za-z0-9._/:+-]{0,299}(?:@sha256:[0-9a-f]{64})?$/i.test(raw)
    ? raw
    : "UNSET";
}

function safeDigest(value: string | undefined): string {
  const raw = value?.trim();
  return raw && /^sha256:[0-9a-f]{64}$/i.test(raw) ? raw : "UNSET";
}

function safeEvidenceId(value: string | undefined): string {
  return safeEvidenceReference(value) ?? "UNSET";
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

function safeComponentVersion(
  value: string | undefined,
  fallback: string,
): string {
  const raw = value?.trim();
  return raw && isReleaseVersion(raw) ? raw : fallback;
}

function safePublicEndpoint(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw) return "UNCONFIGURED";
  try {
    const parsed = new URL(raw);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      unsafeRemoteHostname(parsed.hostname)
    ) {
      return "UNCONFIGURED";
    }
    return parsed.origin;
  } catch {
    return "UNCONFIGURED";
  }
}

/**
 * Manifiesto de despliegue (Build 09.5A §22). Trazabilidad de artefacto:
 * versión de release, commit, esquemas OLTP/DWH, catálogo/políticas/toolset/prompts.
 * Nunca incluye secretos ni datos de pacientes.
 */
export function buildDeploymentManifest(
  env: NodeJS.ProcessEnv = process.env,
): DeploymentManifest {
  const identity = buildEnvironmentIdentity(env);
  const evidenceId = safeEvidenceId(env.SECRET_SCAN_EVIDENCE_ID);
  const secretScanVerified =
    env.SECRET_SCAN_STATUS?.trim().toUpperCase() === "PASS" &&
    env.SECRET_SCAN_COMMIT?.trim() === identity.gitCommit &&
    evidenceId !== "UNSET" &&
    /^[0-9a-f]{40}$/i.test(identity.gitCommit);
  return {
    releaseVersion: identity.releaseVersion,
    gitCommit: identity.gitCommit,
    environment: identity,
    desktopVersion: safeComponentVersion(
      env.DESKTOP_RELEASE_VERSION,
      currentDesktopVersion(),
    ),
    desktopChannel: "primary",
    desktopTauriVersion: currentDesktopTauriVersion(),
    dexieSchemaVersion: DEXIE_SCHEMA_VERSION,
    syncProtocolVersion: SYNC_SCHEMA_VERSION,
    webVersion: currentFrontendVersion(),
    webChannel: "secondary",
    apiVersion: currentApiVersion(),
    apiContractVersion: API_VERSION,
    oltpSchemaVersion: currentOltpSchemaVersion(),
    dwhSchemaVersion: DWH_SCHEMA_VERSION,
    semanticCatalogVersion: CURRENT_VERSIONS.smaeCatalogVersion,
    knowledgePolicyVersion: CURRENT_VERSIONS.knowledgePolicyVersion,
    retrievalPolicyVersion: CURRENT_VERSIONS.retrievalPolicyVersion,
    memoryPolicyVersion: CURRENT_VERSIONS.policyVersion,
    aiPolicyVersion: CURRENT_VERSIONS.policyVersion,
    evaluationDatasetVersion: CURRENT_VERSIONS.evaluationDatasetVersion,
    toolsetVersion: CURRENT_VERSIONS.toolsetVersion,
    promptBundleVersion: currentPromptBundleVersion(),
    outputSchemaBundleVersion: currentOutputSchemaBundleVersion(),
    frontendVersion: currentFrontendVersion(),
    publicEndpoints: {
      api: safePublicEndpoint(env.PUBLIC_API_URL),
      web: safePublicEndpoint(env.PUBLIC_WEB_URL),
    },
    artifacts: {
      desktop: {
        id: safeArtifactId(env.DESKTOP_ARTIFACT),
        digest: safeDigest(env.DESKTOP_ARTIFACT_DIGEST),
      },
      web: {
        id: safeArtifactId(env.WEB_ARTIFACT),
        digest: safeDigest(env.WEB_ARTIFACT_DIGEST),
      },
      api: {
        id: safeArtifactId(env.API_ARTIFACT),
        digest: safeDigest(env.API_ARTIFACT_DIGEST),
      },
    },
    securityEvidence: {
      secretScanStatus: secretScanVerified ? "PASS" : "UNVERIFIED",
      commit: secretScanVerified ? identity.gitCommit : "UNSET",
      evidenceId: secretScanVerified ? evidenceId : "UNSET",
    },
    deployedAt: new Date().toISOString(),
  };
}

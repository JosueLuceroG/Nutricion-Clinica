import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fnv1a32Hex } from '../ai/rag/knowledgeVersioning.js';
import { CURRENT_VERSIONS } from '../ai/certification/versions.js';
import { DWH_SCHEMA_VERSION } from '../dwh/schema/dwhSchema.js';
import { buildEnvironmentIdentity, type EnvironmentIdentity } from './environmentIdentity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'migrations');
const WEB_PACKAGE_JSON = join(__dirname, '..', '..', '..', '..', '..', 'web', 'package.json');

let cachedOltpSchemaVersion: string | null = null;
let cachedFrontendVersion: string | null = null;

/** Última migración del directorio de migraciones (repositorio = fuente de verdad). */
export function currentOltpSchemaVersion(): string {
  if (cachedOltpSchemaVersion !== null) return cachedOltpSchemaVersion;
  try {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{3}-.+\.sql$/.test(f)).sort();
    cachedOltpSchemaVersion = files.length > 0 ? files[files.length - 1]!.split('-')[0]! : '000';
  } catch {
    cachedOltpSchemaVersion = 'UNKNOWN';
  }
  return cachedOltpSchemaVersion;
}

/** Versión del bundle de prompts (hash determinista de TODAS las versiones de prompt). */
export function currentPromptBundleVersion(): string {
  const sorted = Object.values(CURRENT_VERSIONS.promptVersion).sort();
  return `prompt-bundle.${fnv1a32Hex(sorted.join('|'))}`;
}

/** Versión de la app web desde su package.json (sin importarla). */
export function currentFrontendVersion(): string {
  if (cachedFrontendVersion !== null) return cachedFrontendVersion;
  try {
    const pkg = JSON.parse(readFileSync(WEB_PACKAGE_JSON, 'utf8')) as { version?: string };
    cachedFrontendVersion = pkg.version ?? 'UNKNOWN';
  } catch {
    cachedFrontendVersion = 'UNKNOWN';
  }
  return cachedFrontendVersion;
}

export interface DeploymentManifest {
  releaseVersion: string;
  gitCommit: string;
  environment: EnvironmentIdentity;
  oltpSchemaVersion: string;
  dwhSchemaVersion: string;
  semanticCatalogVersion: string;
  knowledgePolicyVersion: string;
  aiPolicyVersion: string;
  toolsetVersion: string;
  promptBundleVersion: string;
  frontendVersion: string;
  apiVersion: string;
  deployedAt: string;
}

/**
 * Manifiesto de despliegue (Build 09.5A §22). Trazabilidad de artefacto:
 * versión de release, commit, esquemas OLTP/DWH, catálogo/políticas/toolset/prompts.
 * Nunca incluye secretos ni datos de pacientes.
 */
export function buildDeploymentManifest(env: NodeJS.ProcessEnv = process.env): DeploymentManifest {
  return {
    releaseVersion: (env.RELEASE_VERSION ?? '0.0.0-dev').trim(),
    gitCommit: buildEnvironmentIdentity(env).gitCommit,
    environment: buildEnvironmentIdentity(env),
    oltpSchemaVersion: currentOltpSchemaVersion(),
    dwhSchemaVersion: DWH_SCHEMA_VERSION,
    semanticCatalogVersion: CURRENT_VERSIONS.smaeCatalogVersion,
    knowledgePolicyVersion: CURRENT_VERSIONS.knowledgePolicyVersion,
    aiPolicyVersion: CURRENT_VERSIONS.policyVersion,
    toolsetVersion: CURRENT_VERSIONS.toolsetVersion,
    promptBundleVersion: currentPromptBundleVersion(),
    frontendVersion: currentFrontendVersion(),
    apiVersion: '0.1.0',
    deployedAt: new Date().toISOString(),
  };
}